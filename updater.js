const axios = require('axios');

// Your Final Verified Configuration
const ADALO_API_KEY = ADALO_API_KEY = process.env.ADALO_API_KEY;
const ADALO_APP_ID = 'f87f7d0f-a56c-47f6-b00b-ef79a9387e2a';
const ADALO_COLLECTION_ID = 'space-coast-events-CSV';
const AI_API_KEY = AI_API_KEY = process.env.GEMINI_API_KEY;

// 1. Scrape raw text content from local entertainment sites
async function scrapeWebpage(url) {
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        return response.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return '';
    }
}

// 2. Use Google Gemini AI to structure the messy text data
async function parseEventsWithAI(rawText) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${AI_API_KEY}`;
        
        const response = await axios.post(url, {
            contents: [{
                parts: [{
                    text: `Extract all live music gigs and community events for the upcoming week from this text. 
                    Return ONLY a raw JSON array of objects with keys: "Name", "Venue", and "Day and time".
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

// 3. Inject the clean events straight into your live Adalo feed
async function pushToAdalo(events) {
    const url = `https://api.adalo.com/v0/apps/${ADALO_APP_ID}/collections/${ADALO_COLLECTION_ID}`;
    
    for (const event of events) {
        try {
            await axios.post(url, {
                "Name": event.Name,
                "Venue": event.Venue,
                "Day and time": event["Day and time"], 
                "Approved": true 
            }, {
                headers: {
                    'Authorization': `Bearer ${ADALO_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`Successfully added: ${event.Name} at ${event.Venue}`);
        } catch (error) {
            console.error(`Failed to push event ${event.Name}:`, error.response?.data || error.message);
        }
    }
}

// Execution sequence
async function runAutomation() {
    console.log("Starting weekly Space Coast events sync...");
    
    // Fixed active URL!
    const brevardLiveText = await scrapeWebpage('https://www.brevardlive.com/events'); 
    const destinationBrevardText = await scrapeWebpage('https://destinationbrevard.com/');

    const combinedText = brevardLiveText + " " + destinationBrevardText;
    
    console.log("Processing text strings with AI extractors...");
    const cleanEvents = await parseEventsWithAI(combinedText);
    
    console.log(`Extracted ${cleanEvents.length} events. Injecting directly to Adalo...`);
    await pushToAdalo(cleanEvents);
    
    console.log("Automation pass completed successfully!");
}

runAutomation();
