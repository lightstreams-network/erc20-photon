var Migrations = artifacts.require("./Migrations.sol");
var LightstreamToken = artifacts.require("./LightstreamToken.sol");
var TeamDistribution = artifacts.require("./distribution/TeamDistribution.sol");
var LightstreamCrowdsale= artifacts.require("./LightstreamCrowdsale.sol");

let timeOffset = 3600 * 24 * 30; // 30 days
let startTime = Math.floor(new Date().getTime() /1000 + (3600 * 24));;
let endTime= startTime + timeOffset;

module.exports = function(deployer) {
  deployer.deploy(LightstreamToken).then(function() {
    return deployer.deploy(TeamDistribution);
  })
  .then(function(){
    return deployer.deploy(LightstreamCrowdsale, startTime.toString(), endTime.toString(), walletAdress, LightstreamToken.address, LightstreamCrowdsale.address);
  });
};
