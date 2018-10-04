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

const PrivateKeyProvider = require('truffle-privatekey-provider');
const HDWalletProvider = require('truffle-hdwallet-provider');
const mnemonic = "pretty icon force payment fine toward artist rely mistake combine kick shiver";

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 9545,
      network_id: '*',
      gas: 6721975
    },
    rinkeby: {
      provider: ()=> {
        // 4868546F8FDE76879690130D4FAAD3E8B043A0C79528BC04D5E15F9B4FD54FCD
        return new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/Yqe59oKMsdh4CnwHxAyE', 0, 10)
      },
      network_id: 4,
      gas: 6721975
    },
  },
  solc: {
    optimizer: {
      enable: true,
      runs: 200
    }
  }
};
