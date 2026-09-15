/*
  Production configuration.
  The public Robinhood Chain RPC is intentionally the default so the project runs immediately.
  For production traffic, replace rpcUrl with a dedicated Robinhood Chain endpoint from your provider.
*/
window.RHC_FACTORY_CONFIG = {
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com'
};
