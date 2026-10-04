import { spawn } from 'node:child_process';
import readline from 'node:readline';

const patterns = [
  { name: 'Private Key', re: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/ },
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'OpenAI/OpenCode Live Key', re: /sk-(live-)?[a-zA-Z0-9]{32,}/ },
  { name: 'HubSpot Live Key', re: /pat-na1-[a-f0-9-]{30,}/i },
];

const gitProcess = spawn('git', ['log', '-p', '--no-color']);
const rl = readline.createInterface({ input: gitProcess.stdout });

let leaks = [];
let lineCount = 0;
let currentCommit = '';

rl.on('line', (line) => {
  lineCount++;
  if (line.startsWith('commit ')) {
    currentCommit = line.slice(7, 15);
  }
  if (line.startsWith('+') && !line.startsWith('+++')) {
    for (const p of patterns) {
      if (p.re.test(line)) {
        if (
          !line.includes('mock_') &&
          !line.includes('fake_') &&
          !line.includes('EXAMPLE') &&
          !line.includes('placeholder') &&
          !line.includes('test_secret') &&
          !line.includes('enc:v') &&
          !line.includes('/sk-')
        ) {
          leaks.push({ commit: currentCommit, pattern: p.name, snippet: line.slice(0, 80) });
        }
      }
    }
  }
});

rl.on('close', () => {
  console.log(`Scan complete. Scanned ${lineCount} diff lines across full git history.`);
  console.log(`Leaks found: ${leaks.length}`);
  if (leaks.length > 0) {
    console.log(JSON.stringify(leaks, null, 2));
  } else {
    console.log('STATUS: CLEAN (0 live secrets detected across entire git history)');
  }
});
