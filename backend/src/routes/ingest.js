

import "../utils/loadEnv.js";
import express from 'express';
import { logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedDocuments, loadDocumentsFromFile, upsertVectors } from '../services/embedLogs.js';
import { Pinecone } from '@pinecone-database/pinecone';

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'debug-logs-hf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });


//console.log(__dirname);


const router = express.Router();

router.post('/', async(req, res) => {
  try{
      const {} = req.body

      //load documents from file ✅
      const INPUT_FILE = path.join(__dirname, '..','..', 'data', 'sample_logs.json');
      const loadedFileDocument = loadDocumentsFromFile(INPUT_FILE)

      //embed documents ✅
      const {vectors, failed} = await embedDocuments(loadedFileDocument);

      //generate an error if no embeddings are found
      if(vectors.length === 0){
        res.status(400).json({
          success: false,
          error: 'No embeddings generated',
          failedCount: failed.length,
          failure: failed
        })
      }

      //get the pinecone index 
      const index = pinecone.index(PINECONE_INDEX);

      //upsert to pinecone
      await upsertVectors(index, vectors)

      res.json({
        success: true,
          totalDocuments: loadedFileDocument.length,
          successfulEmbeddings: vectors.length,
          failedEmbeddings: failed.length,
          upsertedVectors: vectors.length,
          message: 'Embeddings generated and upserted successfully',
          failures: failed.length > 0 ? failed : undefined
      });
    }catch(error){
      logger.error(`Error in ingest route: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }

});
export default router;