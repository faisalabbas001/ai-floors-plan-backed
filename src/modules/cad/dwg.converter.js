/**
 * DWG Converter Service
 * Converts DXF files to DWG format using cloud conversion services
 *
 * Supported conversion methods:
 * 1. CloudConvert API (recommended for production)
 * 2. LibreDWG (open source, local)
 * 3. ODA File Converter (Teigha)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { env } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Convert DXF content to DWG using CloudConvert API
 * @param {string} dxfContent - DXF file content
 * @param {string} outputPath - Where to save the DWG file
 * @returns {Promise<Buffer>} - DWG file buffer
 */
async function convertWithCloudConvert(dxfContent, outputPath) {
  const apiKey = env.CLOUDCONVERT_API_KEY;

  if (!apiKey) {
    throw new Error('CloudConvert API key not configured');
  }

  try {
    // Step 1: Create a job
    const jobResponse = await makeRequest('api.cloudconvert.com', '/v2/jobs', 'POST', apiKey, {
      tasks: {
        'import-dxf': {
          operation: 'import/raw',
          file: dxfContent,
          filename: 'floor-plan.dxf',
        },
        'convert-dwg': {
          operation: 'convert',
          input: 'import-dxf',
          output_format: 'dwg',
        },
        'export-result': {
          operation: 'export/url',
          input: 'convert-dwg',
        },
      },
    });

    const jobId = jobResponse.data.id;
    logger.info(`CloudConvert job created: ${jobId}`);

    // Step 2: Wait for job completion (poll status)
    let job = await pollJobStatus(apiKey, jobId);

    // Step 3: Get the export URL
    const exportTask = job.tasks.find(t => t.name === 'export-result');
    if (!exportTask || exportTask.status !== 'finished') {
      throw new Error('Export task failed');
    }

    const downloadUrl = exportTask.result.files[0].url;

    // Step 4: Download the DWG file
    const dwgBuffer = await downloadFile(downloadUrl);

    logger.info(`DWG file generated successfully (${dwgBuffer.length} bytes)`);
    return dwgBuffer;

  } catch (error) {
    logger.error(`CloudConvert error: ${error.message}`);
    throw error;
  }
}

/**
 * Poll CloudConvert job status until completion
 */
async function pollJobStatus(apiKey, jobId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000); // Wait 2 seconds between polls

    const response = await makeRequest(
      'api.cloudconvert.com',
      `/v2/jobs/${jobId}`,
      'GET',
      apiKey
    );

    const job = response.data;
    logger.debug(`Job ${jobId} status: ${job.status}`);

    if (job.status === 'finished') {
      return job;
    }

    if (job.status === 'error') {
      const errorTask = job.tasks.find(t => t.status === 'error');
      throw new Error(`Conversion failed: ${errorTask?.message || 'Unknown error'}`);
    }
  }

  throw new Error('Job timeout: conversion took too long');
}

/**
 * Alternative: Local DXF to DWG conversion using LibreDWG
 * Requires libredwg to be installed on the system
 * Install: apt-get install libredwg-tools
 */
async function convertWithLibreDWG(dxfContent, outputPath) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const os = require('os');

  // Create temp DXF file
  const tempDir = os.tmpdir();
  const tempDxfPath = path.join(tempDir, `floor-plan-${Date.now()}.dxf`);
  const tempDwgPath = path.join(tempDir, `floor-plan-${Date.now()}.dwg`);

  try {
    // Write DXF content to temp file
    fs.writeFileSync(tempDxfPath, dxfContent);

    // Convert using dwgwrite (LibreDWG tool)
    // Note: This may have limited support for complex DXF features
    await execAsync(`dwgwrite -o "${tempDwgPath}" "${tempDxfPath}"`);

    // Read the generated DWG file
    const dwgBuffer = fs.readFileSync(tempDwgPath);

    logger.info(`LibreDWG conversion successful (${dwgBuffer.length} bytes)`);
    return dwgBuffer;

  } catch (error) {
    logger.error(`LibreDWG error: ${error.message}`);

    // Fallback: return DXF as-is with .dwg extension (not ideal but works in some cases)
    logger.warn('Falling back to DXF format');
    return Buffer.from(dxfContent);

  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempDxfPath)) fs.unlinkSync(tempDxfPath);
      if (fs.existsSync(tempDwgPath)) fs.unlinkSync(tempDwgPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Alternative: Convert using ODA File Converter
 * Requires ODA File Converter to be installed
 * Download from: https://www.opendesign.com/guestfiles/oda_file_converter
 */
async function convertWithODA(dxfContent, outputPath) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const os = require('os');

  const odaPath = env.ODA_CONVERTER_PATH || '/usr/local/bin/ODAFileConverter';

  const tempDir = os.tmpdir();
  const inputDir = path.join(tempDir, `dxf-input-${Date.now()}`);
  const outputDir = path.join(tempDir, `dwg-output-${Date.now()}`);

  try {
    // Create directories
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // Write DXF file
    const dxfPath = path.join(inputDir, 'floor-plan.dxf');
    fs.writeFileSync(dxfPath, dxfContent);

    // Run ODA converter
    // Format: ODAFileConverter "InputFolder" "OutputFolder" ACAD2018 DWG 0 1
    await execAsync(`"${odaPath}" "${inputDir}" "${outputDir}" ACAD2018 DWG 0 1`);

    // Read output DWG
    const dwgPath = path.join(outputDir, 'floor-plan.dwg');
    const dwgBuffer = fs.readFileSync(dwgPath);

    logger.info(`ODA conversion successful (${dwgBuffer.length} bytes)`);
    return dwgBuffer;

  } catch (error) {
    logger.error(`ODA converter error: ${error.message}`);
    throw error;

  } finally {
    // Cleanup
    try {
      fs.rmSync(inputDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Main conversion function - tries available methods in order
 */
async function convertDXFtoDWG(dxfContent, options = {}) {
  const { method = 'auto' } = options;

  // Try methods in order of preference
  const methods = {
    cloudconvert: convertWithCloudConvert,
    libredwg: convertWithLibreDWG,
    oda: convertWithODA,
  };

  if (method !== 'auto' && methods[method]) {
    return methods[method](dxfContent);
  }

  // Auto mode: try CloudConvert first, then local fallbacks
  const tryOrder = ['cloudconvert', 'libredwg', 'oda'];

  for (const m of tryOrder) {
    try {
      // Check if method is configured
      if (m === 'cloudconvert' && !env.CLOUDCONVERT_API_KEY) {
        logger.debug('CloudConvert not configured, skipping');
        continue;
      }

      logger.info(`Trying conversion method: ${m}`);
      return await methods[m](dxfContent);

    } catch (error) {
      logger.warn(`Method ${m} failed: ${error.message}`);
      continue;
    }
  }

  // If all methods fail, return DXF content as fallback
  // (DXF can be opened in AutoCAD directly)
  logger.warn('All DWG conversion methods failed, returning DXF format');
  return {
    buffer: Buffer.from(dxfContent),
    format: 'dxf',
    message: 'DWG conversion unavailable, returning DXF format (compatible with AutoCAD)',
  };
}

// Helper functions

function makeRequest(host, path, method, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Invalid response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  convertDXFtoDWG,
  convertWithCloudConvert,
  convertWithLibreDWG,
  convertWithODA,
};
