// test-gemini.js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  try {
    const model    = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result   = await model.generateContent('Say hello');
    const response = await result.response;
    console.log('Gemini works! Response:', response.text());
  } catch (err) {
    console.log('Full error:', JSON.stringify(err, null, 2));
  }
}

test();