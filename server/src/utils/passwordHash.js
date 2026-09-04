import { hash } from 'bcryptjs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  const password = input.replace(/[\r\n]+$/, '');
  if (!password) {
    process.stderr.write('Provide the password via standard input.\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${await hash(password, 12)}\n`);
});

