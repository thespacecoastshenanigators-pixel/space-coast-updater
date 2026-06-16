const axios = require('axios');

// Secure environment abstractions mapping to host configurations
const ADALO_API_KEY = process.env.ADALO_API_KEY; 
const ADALO_APP_ID = 'f87f7d0f-a56c-47f6-b00b-ef79a9387e2a';
const ADALO_COLLECTION_ID = 't_5us6opts5gujlbp6t3h9jkzq7';
const AI_API_KEY = process.env.GEMINI_API_KEY;

// Phase 1: Scrape text string buffers from targets while masking fingerprints
async function scrapeWebpage(url) {
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        // Wipe heavy HTML layout wrappers, scripts, and padding elements
        return response.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return '';
    }
}

// Phase 2: Deploy Gemini AI context engine to translate chaotic blocks into structured JSON with addresses
async function parseEventsWithAI(rawText) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${AI_API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{
                parts: [{
                    text: `Extract all live music gigs and community events for the upcoming week from this text. 
                    Return ONLY a raw JSON array of objects with keys: "Name", "Venue", "Day and time", and "Address".
                    
                    CRITICAL: For the "Address" key, use your knowledge of Brevard County, Florida to provide the full physical street address, city, and state for the venue (e.g., "3191 Dixie Hwy NE, Palm Bay, FL" or "315 Christopher Columbus Dr, Port Canaveral, FL").
                    
                    Do not wrap the response in markdown blocks like \`\`\`json or include extra text.
                    
                    Raw Text: ${rawText.substring(0, 40000)}`
                }]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const jsonText = response.data.candidates[0].content.parts[0].text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("AI data parsing failed:", error.response?.data || error.message);
        return [];
    }
}

// Phase 3: Loop processed array datasets into Adalo database collection endpoints with mapping support
async function pushToAdalo(events) {
    const url = `https://api.adalo.com/v0/apps/${ADALO_APP_ID}/collections/${ADALO_COLLECTION_ID}`;
    
    for (const event of events) {
        try {
            await axios.post(url, {
                "Name": event.Name,
                "Venue": event.Venue,
                "Day and time": event["Day and time"], 
                "Geographic Location": event.Address, // Direct map link payload!
                "Approved": true 
            }, {
                headers: {
                    'Authorization': `Bearer ${ADALO_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`Successfully mapped and added: ${event.Name} at ${event.Venue} (${event.Address})`);
        } catch (error) {
            console.error(`Failed to push event ${event.Name}:`, error.response?.data || error.message);
        }
    }
}

// Master Orchestration Block
async function runAutomation() {
    console.log("Starting weekly Space Coast events sync with Map locations...");
    
    // Live verified Brevard County target feeds
    const brevardLiveText = await scrapeWebpage('https://www.brevardlive.com/events'); 
    const destinationBrevardText = await scrapeWebpage('https://destinationbrevard.com/');

    const combinedText = brevardLiveText + " " + destinationBrevardText;
    
    console.log("Processing text strings with AI address matching extractors...");
    const cleanEvents = await parseEventsWithAI(combinedText);
    
    console.log(`Extracted ${cleanEvents.length} localized events. Injecting directly to Adalo...`);
    await pushToAdalo(cleanEvents);
    
    console.log("Automation pass completed successfully!");
}

runAutomation();