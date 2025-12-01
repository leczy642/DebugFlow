import fs from 'fs';
import {dirname} from 'path';
import { fileURLToPath } from "url";
import path from 'path';



//const filePath2 = "../data/sample_logs.json";
//get current working file
const __filename = fileURLToPath(import.meta.url);
//get current working directory
const __dirname = dirname(__filename);
//go back two space and join the current path
const filePath = path.join(__dirname, "..","..", "data", "sample_logs.json");


try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(data);
  } catch (err) {
    console.error("Error:", err);
  }