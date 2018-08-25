/*
 * NB: since truffle-hdwallet-provider 0.0.5 you must wrap HDWallet providers in a 
 * function when declaring them. Failure to do so will cause commands to hang. ex:
 * ```
 * mainnet: {
 *     provider: function() { 
 *       return new HDWalletProvider(mnemonic, 'https://mainnet.infura.io/<infura-key>') 
 *     },
 *     network_id: '1',
 *     gas: 4500000,
 *     gasPrice: 10000000000,
 *   },
 */

// module.exports = {
//   rinkeby: {
//     host: "localhost", // Connect to geth on the specified
//     port: 8545,
//     from: "0xb619c08e366706d371d8879b7360c3f22b2cbe92", // default address to use for any transaction Truffle makes during migrations
//     network_id: 4,
//     gas: 4612388 // Gas limit used for deploys
//   }
// };
