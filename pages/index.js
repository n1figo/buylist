// File: pages/index.js (Client-side code)

import { useState, useRef } from 'react';

export default function Home() {
  const [image, setImage] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const pasteAreaRef = useRef(null);

  const handlePaste = async (e) => {
    e.preventDefault();
    setError(null);
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        setImage(blob);
        break;
      }
    }
  };

  const processImage = async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);
    setTableData(null);

    const formData = new FormData();
    formData.append('image', image);

    try {
      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('서버 처리 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      setTableData(data.tableData);
    } catch (error) {
      console.error('Error processing image:', error);
      setError('이미지 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Excel to Web Table Converter</h1>
      <div
        ref={pasteAreaRef}
        onPaste={handlePaste}
        style={{ 
          border: '2px dashed #ccc', 
          padding: '20px', 
          marginBottom: '20px',
          minHeight: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
        tabIndex="0"
        onClick={() => pasteAreaRef.current.focus()}
      >
        {image ? (
          <img src={URL.createObjectURL(image)} alt="Pasted content" style={{ maxWidth: '100%', maxHeight: '300px' }} />
        ) : (
          <p>Ctrl+V로 이미지를 여기에 붙여넣으세요</p>
        )}
      </div>
      <button 
        onClick={processImage} 
        disabled={!image || isProcessing} 
        style={{ marginBottom: '20px' }}
      >
        {isProcessing ? '처리 중...' : '이미지 처리'}
      </button>
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>
      )}
      {tableData && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2rem' }}>
          <thead>
            <tr>
              {tableData[0].map((header, index) => (
                <th key={index} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{ border: '1px solid #ddd', padding: '8px', textAlign: '

left' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// File: pages/api/process-image.js (Server-side code)

import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    const form = new IncomingForm();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    const imagePath = files.image[0].filepath;
    
    // Python script to process the image
    const pythonScript = `
import pytesseract
from PIL import Image
import sys
import json

image = Image.open('${imagePath}')
text = pytesseract.image_to_string(image)
lines = text.split('\\n')
table_data = [line.split('\\t') for line in lines if line.strip()]
print(json.dumps(table_data))
    `;

    // Save Python script to a temporary file
    const scriptPath = '/tmp/process_image.py';
    await fs.writeFile(scriptPath, pythonScript);

    // Execute Python script
    const { stdout, stderr } = await execPromise(`python ${scriptPath}`);

    if (stderr) {
      console.error('Python script error:', stderr);
      return res.status(500).json({ error: 'Image processing failed' });
    }

    const tableData = JSON.parse(stdout);

    // Clean up temporary files
    await fs.unlink(imagePath);
    await fs.unlink(scriptPath);

    return res.status(200).json({ tableData });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}