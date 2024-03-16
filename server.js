const mysql = require('mysql2/promise');
const fs = require('fs');
const os = require('os');
const express = require('express');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const cors = require('cors');

const app = express();
app.use(cors());
const port = 3000;

// Set up storage engine
const storage = multer.memoryStorage(); // Using memory storage for simplicity
const upload = multer({ storage: storage });

app.use(express.static('public')); // Serve static files from 'public' directory

// Test route.
app.get('/test', (req, res) => {
    res.status(200).send('OK');
});
// Route to handle file upload
app.post('/upload', upload.single('image'), async (req, res) => {
    const maxPrice = req.body.maxPrice;
    const keyword = req.body.keyword;

    if (req.file) {
        const tempFilePath = path.join(os.tmpdir(), req.file.originalname);
        try {
            await writeFileAsync(tempFilePath, req.file.buffer);

        const pythonProcess = spawn('python3', ['embedding.py', tempFilePath]);

        let dataString = '';
        pythonProcess.stdout.on('data',(data) => {
            dataString += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            await unlinkAsync(tempFilePath); // delete temp file

            if (code !== 0) {
                console.error(`Python script exited with code ${code}`);
                return res.status(500).send('Failed to generate embedding');
            }
            
            try {
                const embedding = JSON.parse(dataString); // Parse the embedding JSON from Python script
                const topMatches = await findTopMatches(embedding, 'cutout', maxPrice, keyword);
                // Respond with the top matches
                res.json(topMatches);
            } catch (error) {
                console.error('Error processing the embedding:', error);
                res.status(500).send('Error processing the embedding');
            }
        });
        } catch (error) {
            console.error('Error processing the image:', error);
            res.status(500).send('Error processing the image');
        }
    } else {
        res.status(400).send('No file uploaded.');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const HOST = 'svc-bd788f8f-c95e-470d-a767-462840795288-dml.aws-oregon-3.svc.singlestore.com';
const USER = 'admin';
const PASSWORD = 'Singlestore1';
const DATABASE = 'vectordb';

// main is run at the end
async function main() {
    let singleStoreConnection;
    try {
        singleStoreConnection = await mysql.createConnection({
        host: HOST,
        user: USER,
        password: PASSWORD,
        database: DATABASE
        });
  
        console.log("You have successfully connected to SingleStore.");
    } catch (err) { 
        console.error('ERROR', err);
        process.exit(1);
    } finally {
        if (singleStoreConnection) {
            await singleStoreConnection.end();
        }
    }
}

main();

async function findTopMatches(queryEmbedding, embeddingType = 'model', maxPrice, keyword) {
    const connection = await mysql.createConnection({
        host: HOST,
        user: USER,
        password: PASSWORD,
        database: DATABASE       
    });

    const queryEmbeddingStr = queryEmbedding.join(',');
    const setVectorQuery = `SET @query_vec = '[${queryEmbeddingStr}]' :> VECTOR(512);`;

    await connection.execute(setVectorQuery);

    let results = null;

    if (keyword) {
        const query = `
        SELECT brand_name, image_cutout_url, short_description, price, DOT_PRODUCT(${embeddingType}_embedding, @query_vec) AS similarity_score
        FROM farfetch_listings
        WHERE price < ?
        AND MATCH (short_description) AGAINST (?)
        ORDER BY similarity_score DESC
        LIMIT 3;
    `;
    [results] = await connection.execute(query, [maxPrice, keyword]);

    } else {
        const query = `
        SELECT brand_name, image_cutout_url, short_description, price, DOT_PRODUCT(${embeddingType}_embedding, @query_vec) AS similarity_score
        FROM farfetch_listings
        WHERE price < ?
        ORDER BY similarity_score DESC
        LIMIT 3;
    `;

    [results] = await connection.execute(query, [maxPrice]);

    }

    await connection.end();

    return results;
}


