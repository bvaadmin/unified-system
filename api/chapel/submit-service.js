import { handleChapelSubmission } from '../../lib/handlers/chapel/submit-service.js';

export default async function handler(req, res) {
  return handleChapelSubmission(req, res);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  maxDuration: 10
};