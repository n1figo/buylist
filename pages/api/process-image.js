// File: pages/api/process-image.js

import formidable from 'formidable';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const form = formidable();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    if (!files.image) {
      throw new Error('No image file uploaded');
    }

    console.log('Received file:', files.image);
    
    const imagePath = files.image[0].filepath;
    console.log('File path:', imagePath);
    
    const absoluteImagePath = path.resolve(imagePath);
    console.log('Absolute file path:', absoluteImagePath);
    
    // Python script to process the image
    const pythonScript = `
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import sys
import json
import traceback

def preprocess_image(image_path):
    # Open the image
    img = Image.open(image_path)
    
    # Convert to grayscale
    img = img.convert('L')
    
    # Increase contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2)
    
    # Increase sharpness
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(2)
    
    # Apply a slight blur to reduce noise
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    
    return img

try:
    # Preprocess the image
    preprocessed_image = preprocess_image(r'${absoluteImagePath.replace(/\\/g, '\\\\')}')
    
    # Perform OCR with custom configuration
    custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1 -l kor+eng'
    text = pytesseract.image_to_string(preprocessed_image, config=custom_config)
    
    # Split the text into lines and then into cells
    lines = text.strip().split('\\n')
    table_data = [line.split() for line in lines]
    
    print(json.dumps({"success": True, "data": table_data}))
except Exception as e:
    error_info = {
        "type": type(e).__name__,
        "message": str(e),
        "traceback": traceback.format_exc()
    }
    print(json.dumps({"success": False, "error": error_info}))
    `;

    // Save Python script to a temporary file
    const scriptPath = '/tmp/process_image.py';
    await fs.writeFile(scriptPath, pythonScript);

    // Execute Python script
    const { stdout, stderr } = await execPromise(`python3 ${scriptPath}`);

    if (stderr) {
      console.error('Python script error:', stderr);
      return res.status(500).json({ error: 'Image processing failed', details: stderr });
    }

    const result = JSON.parse(stdout);
    if (!result.success) {
      console.error('Python script error:', result.error);
      return res.status(500).json({ error: 'Image processing failed', details: result.error });
    }

    // Clean up temporary files
    await fs.unlink(imagePath);
    await fs.unlink(scriptPath);

    return res.status(200).json({ tableData: result.data });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}