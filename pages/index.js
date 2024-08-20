// File: pages/index.js

import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';

export default function Home() {
  const [image, setImage] = useState(null);
  const [tableData, setTableData] = useState(null);
  const pasteAreaRef = useRef(null);

  const handlePaste = async (e) => {
    e.preventDefault();
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          setImage(event.target.result);
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  };

  const processImage = async () => {
    if (!image) return;

    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(image);
    await worker.terminate();

    // Simple parsing logic (you might need to improve this based on your specific use case)
    const rows = text.split('\n').map(row => row.split('\t'));
    setTableData(rows);
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
          justifyContent: 'center'
        }}
        tabIndex="0"
      >
        {image ? (
          <img src={image} alt="Pasted content" style={{ maxWidth: '100%', maxHeight: '300px' }} />
        ) : (
          <p>Ctrl+V로 이미지를 여기에 붙여넣으세요</p>
        )}
      </div>
      <button onClick={processImage} disabled={!image} style={{ marginBottom: '20px' }}>
        Process Image
      </button>
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
                  <td key={cellIndex} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}