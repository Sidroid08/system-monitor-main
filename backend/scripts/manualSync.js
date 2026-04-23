import dotenv from 'dotenv';
import { syncAwsAccountInstances } from '../src/services/awsSyncService.js';

dotenv.config();

const awsAccountId = Number(process.argv[2]);
if (!awsAccountId) {
  console.error('Usage: npm run sync -- <awsAccountId>');
  process.exit(1);
}

syncAwsAccountInstances(awsAccountId)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
