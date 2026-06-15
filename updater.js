const axios = require('axios');

// Your Final Verified Configuration
const ADALO_API_KEY = 'a5pk3x3uz3ojd92usc8sds4zq';
const ADALO_APP_ID = 'f87f7d0f-a56c-47f6-b00b-ef79a9387e2a';
const ADALO_COLLECTION_ID = 'space-coast-events-CSV';
const AI_API_KEY = 'YOUR_OPENAI_OR_GEMINI_API_KEY'; // Replace with your AI Provider Key

// 1. Scrape raw text content from local entertainment sites
async function scrapeWebpage(url) {
    try {
        const response = await axios.get(url);
        // Wipe heavy HTML tags to just pass clean text string to AI
        return response.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return '';
    }
}

// 2. Use AI to extract messy data into flawless JSON structure
async function parseEventsWithAI(rawText) {
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini", // Fast, highly precise for structured extraction
            messages: [{
                role: "user",
                content: `Extract all live music gigs and community events for the upcoming week from this text. 
                Return ONLY a raw JSON array of objects with keys: "Name", "Venue", and "Day and time".
                Do not wrap the response in markdown blocks or include extra text.
                Raw Text: ${rawText.substring(0, 40000)}`
            }],
            temperature: 0.1
        }, {
            headers: { 'Authorization': `Bearer ${AI_API_KEY}` }
        });

        return JSON.parse(response.data.choices[0].message.content.trim());
    } catch (error) {
        console.error("AI data parsing failed:", error.message);
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
                "Day and time": event["Day and time"], // Cleaned JavaScript bracket notation
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
    
    const brevardLiveText = await scrapeWebpage('https://brevardlive.com/music-gigs/'); 
    const destinationBrevardText = await scrapeWebpage('https://destinationbrevard.com/events/');

    const combinedText = brevardLiveText + " " + destinationBrevardText;
    
    console.log("Processing text strings with AI extractors...");
    const cleanEvents = await parseEventsWithAI(combinedText);
    
    console.log(`Extracted ${cleanEvents.length} events. Injecting directly to Adalo...`);
    await pushToAdalo(cleanEvents);
    
    console.log("Automation pass completed successfully!");
}

runAutomation();