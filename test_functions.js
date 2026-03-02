/**
 * Test script to verify that Supabase functions are working correctly
 */

const axios = require('axios');

// Replace with your actual Supabase project details
const SUPABASE_URL = 'https://vnhllbfvpkzdbqbitnnb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuaGxsYmZ2cGt6ZGJxYml0bm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTkyNDEsImV4cCI6MjA4NzY3NTI0MX0.4I7fPCVTM-Wv67i5eY-XGY187eQMCHzULiRJ70SHX4A';

async function testFunction(functionName, token = null) {
  try {
    console.log(`\nTesting ${functionName}...`);
    
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await axios.post(
      `${SUPABASE_URL}/functions/v1/${functionName}`,
      {},
      { 
        headers,
        timeout: 10000 // 10 second timeout
      }
    );
    
    console.log(`${functionName} - Status: ${response.status}`);
    console.log(`${functionName} - Response:`, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`${functionName} - Error:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

async function runTests() {
  console.log('Running Supabase Functions Tests...\n');
  
  // Test functions that don't require authentication
  await testFunction('gmail-callback'); // This should return an error for missing params but not auth error
  await testFunction('cron-worker'); // This should return an error for missing params but not auth error
  await testFunction('grace-period-check'); // This should return an error for missing params but not auth error
  
  console.log('\nNote: Some functions require authentication and specific parameters.');
  console.log('Functions like fetch-emails, generate-followups, etc. need valid user tokens.');
  
  console.log('\nTest completed!');
}

// Run the tests
runTests().catch(console.error);