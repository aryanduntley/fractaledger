/**
 * Basic API Extension Template
 * 
 * This is a template for creating custom API extensions for the FractaLedger system.
 * It provides a simple structure that you can customize to add your own endpoints.
 */

/**
 * Register the extension with the API server
 * @param {Object} app The Express app instance
 * @param {Function} authenticateJWT The authentication middleware
 * @param {Object} dependencies Additional dependencies (walletManager, fabricClient, etc.)
 */
function registerBasicExtension(app, authenticateJWT, dependencies) {
  const { walletManager, fabricClient } = dependencies;
  
  /**
   * Example endpoint
   * GET /api/example
   */
  app.get('/api/example', authenticateJWT, async (req, res) => {
    try {
      // Your endpoint logic here
      res.json({
        message: 'This is an example endpoint from a custom API extension',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Example endpoint with parameters
   * GET /api/example/:id
   */
  app.get('/api/example/:id', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Your endpoint logic here
      res.json({
        id,
        message: `This is an example endpoint with parameter: ${id}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Example endpoint with request body
   * POST /api/example
   */
  app.post('/api/example', authenticateJWT, async (req, res) => {
    try {
      const { name, value } = req.body;
      
      if (!name || value === undefined) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Your endpoint logic here
      res.json({
        name,
        value,
        message: 'This is an example endpoint with request body',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Example endpoint with Fabric interaction
   * POST /api/example/fabric
   */
  app.post('/api/example/fabric', authenticateJWT, async (req, res) => {
    try {
      const { functionName, args } = req.body;
      
      if (!functionName || !args) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Call a chaincode function
      const result = await fabricClient.submitTransaction(functionName, ...args);
      const data = JSON.parse(result.toString());
      
      res.json({
        functionName,
        args,
        data,
        message: 'This is an example endpoint with Fabric interaction',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Example endpoint with wallet interaction
   * GET /api/example/wallet/:id
   */
  app.get('/api/example/wallet/:id', authenticateJWT, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the internal wallet
      const internalWallet = await walletManager.getInternalWallet(id);
      
      if (!internalWallet) {
        return res.status(404).json({ error: 'Internal wallet not found' });
      }
      
      res.json({
        wallet: internalWallet,
        message: 'This is an example endpoint with wallet interaction',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerBasicExtension;
