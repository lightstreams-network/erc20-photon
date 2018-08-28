var Token = artifacts.require("./LightstreamToken.sol");
var Sale = artifacts.require("./LightstreamCrowdsale.sol");
var Distribution = artifacts.require("./distribution/TeamDistribution.sol");

let timeOffset = 3600 * 24 * 30; // 30 days
let startTime = Math.floor(new Date().getTime() / 1000 + (3600 * 24));
let endTime = startTime + timeOffset;

module.exports = function (deployer, network, accounts) {
  deployer.deploy(Token).then((d) => {
    return deployer.deploy(Distribution, startTime, d.address)
      .then((distrib) => [d, distrib])
  }).then(([d, distrib]) => {
    return deployer.deploy(Sale, startTime, endTime, accounts[0], d.address, distrib.address)
  })
};
