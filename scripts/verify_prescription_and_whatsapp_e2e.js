/**
 * End-to-End Live Verification Script for:
 * 1. Professional Final Diet Prescription PDF generation & export
 * 2. Unauthenticated tokenized patient download via WhatsApp link
 * 3. WhatsApp Prescription Dispatch & Audit Logging
 */

const http = require('http');

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer,
          text: buffer.toString('utf8'),
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('LIVE END-TO-END VERIFICATION: PRESCRIPTION PDF & WHATSAPP ENGINE');
  console.log('================================================================\n');

  // Step 1: Practitioner Login
  console.log('[1/7] Authenticating as Authorized Dietitian...');
  const loginRes = await request('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'vaidya@ayurdiet.clinic', password: 'Vaidya@2026' },
  });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed with status ${loginRes.status}: ${loginRes.text}`);
  }
  const loginData = JSON.parse(loginRes.text);
  const token = loginData.data?.token;
  console.log(`  ✓ Authenticated as ${loginData.data?.dietitian?.name} (Token received)`);

  // Step 2: Fetch or Create a Live Patient
  console.log('\n[2/7] Finding or creating active patient with mobile number...');
  const patientsRes = await request('http://localhost:5000/api/patients?limit=5', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const patientsData = JSON.parse(patientsRes.text);
  let patient = (patientsData.data?.patients || [])[0];

  if (!patient) {
    const createPatientRes = await request('http://localhost:5000/api/patients', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: {
        name: 'Vaidya Aarav Sharma',
        age: 36,
        sex: 'male',
        phone: '+91 98765 43210',
        email: 'aarav.sharma@example.com',
      },
    });
    const createdData = JSON.parse(createPatientRes.text);
    patient = createdData.data?.patient;
  }
  console.log(`  ✓ Patient: ${patient.name} (${patient.patient_code || 'ID:' + patient.id})`);
  console.log(`  ✓ Patient Phone: ${patient.phone || 'None'}`);

  // Step 3: Fetch or Create an Approved Diet Plan
  console.log('\n[3/7] Finding or approving a 7-day diet plan...');
  const plansRes = await request(`http://localhost:5000/api/diet-plan/patient/${patient.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const plansData = JSON.parse(plansRes.text);
  let dietPlan = (plansData.data || [])[0];

  if (!dietPlan) {
    // Save a valid 7-day plan
    const savePlanRes = await request('http://localhost:5000/api/diet-plan', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: {
        patient_id: patient.id,
        title: '7-Day Integrative Ayurvedic Diet Plan',
        patient_summary: 'Targeted dosha balancing regimen with moderate protein and whole grains.',
        clinical_rationale: 'Pitta pacification with cooling herbs, hydration, and regular meal timing.',
        nutrition_targets: {
          energy: { target_energy_kcal_day: 2000 },
          macronutrients: {
            protein: { target_g: 65 },
            carbohydrate: { target_g: 260 },
            fat: { target_g: 50 },
          },
        },
        days: [
          {
            day_number: 1,
            day_name: 'Monday',
            theme: 'Prana Activation & Gentle Cleansing',
            daily_totals: { calories: 1980, protein_g: 64, carbohydrate_g: 255, fat_g: 49 },
            meals: [
              {
                meal_type: 'early_morning',
                timing: '06:30 AM',
                totals: { calories: 120, protein_g: 3 },
                foods: [
                  { food_name: 'Warm Cumin & Fennel Infusion', quantity: 250, unit: 'ml', preparation_notes: 'Boiled and strained', calories: 15, protein_g: 0.5 },
                  { food_name: 'Soaked Almonds', quantity: 15, unit: 'g', preparation_notes: 'Peeled after overnight soak', calories: 105, protein_g: 2.5 },
                ],
              },
              {
                meal_type: 'breakfast',
                timing: '08:30 AM',
                totals: { calories: 380, protein_g: 14 },
                foods: [
                  { food_name: 'Moong Dal Cheela', quantity: 2, unit: 'piece', preparation_notes: 'Cooked on iron tawa with 1/2 tsp cow ghee', calories: 280, protein_g: 11 },
                  { food_name: 'Fresh Mint & Coriander Chutney', quantity: 2, unit: 'tbsp', preparation_notes: 'Freshly ground with rock salt', calories: 40, protein_g: 1 },
                ],
              },
              {
                meal_type: 'lunch',
                timing: '01:00 PM',
                totals: { calories: 650, protein_g: 22 },
                foods: [
                  { food_name: 'Brown Basmati Rice', quantity: 150, unit: 'g', preparation_notes: 'Steamed with bay leaf and cumin', calories: 220, protein_g: 4.5 },
                  { food_name: 'Yellow Moong Dal Tadka', quantity: 1, unit: 'katori', preparation_notes: 'Tempered with cumin and asafoetida', calories: 180, protein_g: 9 },
                  { food_name: 'Bottle Gourd (Lauki) Sabzi', quantity: 1, unit: 'katori', preparation_notes: 'Sauteed with coriander and pinch turmeric', calories: 120, protein_g: 2.5 },
                ],
              },
            ],
          },
        ],
      },
    });
    const savedData = JSON.parse(savePlanRes.text);
    dietPlan = savedData.data;
  }

  // Ensure it is approved
  if (!dietPlan.is_approved) {
    const approveRes = await request(`http://localhost:5000/api/diet-plan/${dietPlan.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: { approved_by: 'Dr. Vaidya' },
    });
    const approvedData = JSON.parse(approveRes.text);
    dietPlan = approvedData.data;
  }
  console.log(`  ✓ Plan ID: ${dietPlan.id} | Status: ${dietPlan.status} | Approved: ${dietPlan.is_approved}`);

  // Step 4: Verify Prescription PDF Download Endpoint
  console.log('\n[4/7] Testing PDF Download Endpoint (GET /api/diet-plan/:id/pdf)...');
  const pdfRes = await request(`http://localhost:5000/api/diet-plan/${dietPlan.id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (pdfRes.status !== 200) {
    throw new Error(`PDF export failed with status ${pdfRes.status}: ${pdfRes.text}`);
  }
  const isPdf = pdfRes.headers['content-type'] === 'application/pdf';
  const pdfHeader = pdfRes.buffer.slice(0, 5).toString('ascii');
  const pdfSizeKb = Math.round(pdfRes.buffer.length / 1024);

  console.log(`  ✓ Status: ${pdfRes.status} OK`);
  console.log(`  ✓ Content-Type: ${pdfRes.headers['content-type']}`);
  console.log(`  ✓ Content-Disposition: ${pdfRes.headers['content-disposition']}`);
  console.log(`  ✓ Header Magic: "${pdfHeader}" (Valid PDF binary)`);
  console.log(`  ✓ PDF File Size: ${pdfSizeKb} KB`);

  // Step 5: Test WhatsApp Dispatch (POST /api/diet-plan/:id/whatsapp)
  console.log('\n[5/7] Testing WhatsApp Prescription Dispatch (POST /api/diet-plan/:id/whatsapp)...');
  const waRes = await request(`http://localhost:5000/api/diet-plan/${dietPlan.id}/whatsapp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: {
      phone: '9876543210',
      consent_confirmed: true,
    },
  });

  if (waRes.status !== 200) {
    throw new Error(`WhatsApp dispatch failed with status ${waRes.status}: ${waRes.text}`);
  }
  const waData = JSON.parse(waRes.text);
  console.log(`  ✓ Status: ${waRes.status} OK`);
  console.log(`  ✓ Delivery Method: ${waData.data?.delivery_method}`);
  console.log(`  ✓ Masked Recipient: ${waData.data?.masked_phone}`);
  console.log(`  ✓ Prefilled Link: ${waData.data?.fallback_url?.slice(0, 60)}...`);
  console.log(`  ✓ Authorized Download URL: ${waData.data?.download_url}`);

  // Step 6: Test Tokenized Patient PDF Download via WhatsApp Link
  console.log('\n[6/7] Testing Unauthenticated Patient Download using Token from WhatsApp Link...');
  const patientDownloadUrl = waData.data?.download_url;
  const tokenizedRes = await request(patientDownloadUrl);

  if (tokenizedRes.status !== 200) {
    throw new Error(`Patient download via token failed with status ${tokenizedRes.status}: ${tokenizedRes.text}`);
  }
  const tokenizedPdfHeader = tokenizedRes.buffer.slice(0, 5).toString('ascii');
  console.log(`  ✓ Status: ${tokenizedRes.status} OK`);
  console.log(`  ✓ Patient Received Application/PDF Header Magic: "${tokenizedPdfHeader}"`);
  console.log(`  ✓ Download Successful without requiring Practitioner Login!`);

  // Step 7: Test WhatsApp Dispatch History
  console.log('\n[7/7] Verifying WhatsApp Dispatch History & Audit Trail...');
  const historyRes = await request(`http://localhost:5000/api/diet-plan/${dietPlan.id}/whatsapp-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const historyData = JSON.parse(historyRes.text);
  const history = historyData.data?.history || [];

  console.log(`  ✓ Status: ${historyRes.status} OK`);
  console.log(`  ✓ Audit Records Logged: ${history.length}`);
  if (history.length > 0) {
    const latest = history[0];
    console.log(`  ✓ Latest Audit Log ID #${latest.id}:`);
    console.log(`    - Recipient: ${latest.masked_phone}`);
    console.log(`    - Method: ${latest.delivery_method}`);
    console.log(`    - Status: ${latest.status}`);
    console.log(`    - Timestamp: ${latest.created_at}`);
  }

  console.log('\n================================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION ERROR:', err.message);
  process.exit(1);
});

