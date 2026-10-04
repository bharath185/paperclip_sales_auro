async function run() {
  const compRes = await fetch('http://localhost:3100/api/companies');
  const companies = await compRes.json();
  const company = companies[0];
  console.log('Target Company:', company.id, '(' + company.name + ')');

  // 1. Create a new Outbound Campaign
  const createRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Aerospace & Precision Machining Bengaluru Q4',
      industry: 'Manufacturing',
      subSegment: 'Aerospace & Defense Machining',
      location: 'Peenya & Whitefield Industrial Corridors, Bengaluru',
      companySize: '50-500',
      targetTitles: ['VP of Operations', 'Plant General Manager', 'Head of Tooling Engineering'],
      offerProposition: 'AI-driven automated quality inspection and zero-defect machining telemetry.',
      callToAction: 'Can we schedule a 10-minute briefing next Tuesday to show you our live defect detection rate?',
      dailyLeadQuota: 20,
      isDemo: true,
      complianceSettings: {
        dryRun: true,
        requireHumanApproval: true,
        perDomainHourlyLimit: 5,
        enableWarmupRamp: true,
      },
    }),
  });
  const campaign = await createRes.json();
  console.log('\n[1] CAMPAIGN CREATED:');
  console.log('  ID:', campaign.id);
  console.log('  Name:', campaign.name);
  console.log('  Status:', campaign.status);

  // 2. Trigger Research Stage (AI Lead Researcher Agent)
  const resResearch = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const researchData = await resResearch.json();
  const leads = researchData.leads || [];
  console.log('\n[2] RESEARCH STAGE COMPLETED:');
  console.log('  Discovered Leads Count:', leads.length);
  leads.forEach((l, idx) => {
    console.log(`   ${idx + 1}. ${l.companyName} | Contact: ${l.decisionMakerName} (${l.decisionMakerTitle}) | Score: ${l.score}/100 | Source: ${l.dataSource}`);
  });

  // 3. Get Human Approval Batch
  const appRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/approvals`);
  const batches = await appRes.json();
  const batch = batches[0];
  console.log('\n[3] APPROVAL BATCH INBOX:');
  console.log('  Batch ID:', batch.id);
  console.log('  Batch Status:', batch.status);
  console.log('  Leads Awaiting Review:', batch.leads.length);

  // 4. CEO / Sales Manager Approves Leads
  const leadIds = batch.leads.map((l) => l.id);
  const approveRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/approvals/${batch.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvedLeadIds: leadIds }),
  });
  const approvedBatch = await approveRes.json();
  console.log('\n[4] LEAD BATCH APPROVED:');
  console.log('  Updated Batch Status:', approvedBatch.status);
  console.log('  Approved Count:', approvedBatch.leads.length);

  // 5. Generate 3-Touch Email Sequence
  const seqRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/sequence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const seqData = await seqRes.json();
  console.log('\n[5] EMAIL SEQUENCE GENERATED:');
  console.log('  Total Steps:', seqData.steps.length);
  seqData.steps.forEach((s) => {
    console.log(`   Step ${s.stepNumber} (Day +${s.delayDays}): "${s.subjectTemplate}"`);
  });

  // 6. Inbound Hot Reply Simulation
  const hotRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/hot-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId: campaign.id,
      leadId: leads[0].id,
      companyName: leads[0].companyName,
      contactName: leads[0].decisionMakerName,
      contactEmail: leads[0].email,
      replySnippet: 'We are currently upgrading our AS9100 CNC cell in Peenya. Let us schedule a 15-minute intro call next Tuesday at 2 PM.',
      sentiment: 'meeting_requested',
    }),
  });
  const hotLead = await hotRes.json();
  console.log('\n[6] HOT LEAD INBOUND TRIAGE:');
  console.log('  Company:', hotLead.companyName);
  console.log('  Decision Maker:', hotLead.contactName, `(${hotLead.contactEmail})`);
  console.log('  Sentiment:', hotLead.sentiment);
  console.log('  Snippet:', `"${hotLead.replySnippet}"`);

  // 7. CRM Sync (CSV / Webhook / HubSpot)
  const syncRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/crm-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crmConfig: { provider: 'csv_export', isMock: true } }),
  });
  const syncResult = await syncRes.json();
  console.log('\n[7] CRM SYNC RESULT:');
  console.log('  Synced Count:', syncResult.synced);
  console.log('  Status:', syncResult.results.map((r) => r.status).join(', '));
}

run().catch(console.error);
