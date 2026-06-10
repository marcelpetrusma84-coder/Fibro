// fibro.js - Fibro Local-First Prototype met Echte JSON Opslag
const fs = require('fs');
const path = require('path');

class FibroNode {
    constructor(deviceName, storageFileName) {
        this.deviceName = deviceName;
        this.storagePath = path.join(__dirname, storageFileName);
        
        // Standaard beginstatus
        this.state = {
            profile: { username: "Anoniem", bio: "Nog geen bio", updatedAt: 0 },
            posts: []
        };

        // Laad direct bestaande data in als het bestand al op de schijf staat
        this.loadFromDisk();
    }

    // Laad JSON van de schijf
    loadFromDisk() {
        if (fs.existsSync(this.storagePath)) {
            const rawData = fs.readFileSync(this.storagePath, 'utf-8');
            this.state = JSON.parse(rawData);
        } else {
            this.saveToDisk(); // Maak het bestand aan als het nog niet bestaat
        }
    }

    // Schrijf de huidige status weg als JSON naar de schijf
    saveToDisk() {
        fs.writeFileSync(this.storagePath, JSON.stringify(this.state, null, 2), 'utf-8');
    }

    // Profiel lokaal bijwerken (en opslaan)
    updateProfile(username, bio) {
        this.state.profile.username = username;
        this.state.profile.bio = bio;
        this.state.profile.updatedAt = Date.now();
        this.saveToDisk();
        console.log(`[${this.deviceName}] Profiel bijgewerkt en opgeslagen in ${path.basename(this.storagePath)}`);
    }

    // Bericht lokaal plaatsen (en opslaan)
    createPost(content) {
        const post = {
            id: `${this.deviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            content: content,
            timestamp: Date.now()
        };
        this.state.posts.push(post);
        this.saveToDisk();
        console.log(`[${this.deviceName}] Bericht geplaatst en opgeslagen in ${path.basename(this.storagePath)}`);
    }

    // P2P Synchronisatie via JSON bestanden
    syncWith(remotePeer) {
        console.log(`\n--- P2P SYNC: [${this.deviceName}] leest JSON van [${remotePeer.deviceName}] ---`);
        
        // Zorg dat we de meest recente schijf-data van de ander gebruiken
        remotePeer.loadFromDisk();
        this.loadFromDisk();

        // 1. CRDT Profiel Merge (Last-Write-Wins)
        if (remotePeer.state.profile.updatedAt > this.state.profile.updatedAt) {
            console.log(`-> [${this.deviceName}] neemt nieuwer profiel over van [${remotePeer.deviceName}]`);
            this.state.profile = { ...remotePeer.state.profile };
        } else if (remotePeer.state.profile.updatedAt < this.state.profile.updatedAt) {
            console.log(`-> [${this.deviceName}] pusht nieuwer profiel naar [${remotePeer.deviceName}]`);
            remotePeer.state.profile = { ...this.state.profile };
        }

        // 2. CRDT Berichten Merge (Append-Only)
        const allPosts = [...this.state.posts, ...remotePeer.state.posts];
        const uniquePosts = allPosts.filter((post, index, self) =>
            index === self.findIndex((p) => p.id === post.id)
        );
        uniquePosts.sort((a, b) => a.timestamp - b.timestamp);

        // Update de status van beide objecten
        this.state.posts = [...uniquePosts];
        remotePeer.state.posts = [...uniquePosts];

        // Sla de nieuwe, samengevoegde data direct op naar BEIDE JSON bestanden
        this.saveToDisk();
        remotePeer.saveToDisk();

        console.log(`-> Synchronisatie voltooid! Beide JSON-bestanden op de schijf zijn nu bijgewerkt.`);
    }

    // Toon huidige schijf-status in de console
    display() {
        this.loadFromDisk(); // Altijd eerst van de schijf lezen om te tonen wat er écht staat
        console.log(`\n===================================`);
        console.log(` BESTAND op schijf: ${path.basename(this.storagePath)} (${this.deviceName})`);
        console.log(`===================================`);
        console.log(` PROFIEL:`);
        console.log(`   Gebruikersnaam: ${this.state.profile.username}`);
        console.log(`   Bio:            ${this.state.profile.bio}`);
        console.log(`-----------------------------------`);
        console.log(` TIJDLIJN:`);
        if (this.state.posts.length === 0) console.log("   (Geen berichten)");
        this.state.posts.forEach(p => {
            console.log(`   [${new Date(p.timestamp).toLocaleTimeString()}] ${p.content}`);
        });
        console.log(`===================================\n`);
    }
}

// === DE SIMULATIE DRAAIEN ===

// We maken de twee apparaten aan en koppelen ze aan een EIGEN json bestand op je schijf
const mijnTelefoon = new FibroNode("Mijn Telefoon", "telefoon_storage.json");
const mijnLaptop = new FibroNode("Mijn Laptop", "laptop_storage.json");

console.log("--- STAP 1: De apparaten typen onafhankelijk van elkaar offline data ---");
mijnTelefoon.updateProfile("PixelArtFan", "Analoog in een digitale wereld.");
mijnTelefoon.createPost("Groeten vanaf m'n telefoon! #localfirst");

mijnLaptop.createPost("En deze tekst staat eerst alleen op m'n laptop.");

console.log("\n--- STAP 2: Bekijk de twee losse JSON-bestanden vóór de synchronisatie ---");
mijnTelefoon.display();
mijnLaptop.display();

console.log("\n--- STAP 3: De apparaten synchroniseren en schrijven de merge naar de schijf ---");
mijnTelefoon.syncWith(mijnLaptop);

console.log("\n--- STAP 4: Bekijk de bestanden na de synchronisatie (ze zijn nu identiek!) ---");
mijnTelefoon.display();
mijnLaptop.display();
