export default async function handler(req, res) {
  return res.status(200).json({
    message: 'Deployment test successful',
    timestamp: new Date().toISOString(),
    method: req.method,
    availabilityCheckRemoved: true
  });
}