let LightstreamToken = artifacts.require("LightstreamToken");
let TeamDistribution = artifacts.require("distribution/TeamDistribution");
let LightstreamCrowdsale = artifacts.require("LightstreamCrowdsale");


const timeTravel = function (time) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
    jsonrpc: "2.0",
    method: "evm_increaseTime",
    params: [time], // 86400 is num seconds in day
    id: new Date().getTime()
  }, (err, result) => {
    if(err){ return reject(err) }
    return resolve(result)
  });
})
};

const mineBlock = function () {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
    jsonrpc: "2.0",
    method: "evm_mine"
  }, (err, result) => {
    if(err){ return reject(err) }
    return resolve(result)
  });
})
};

contract('LightstreamToken', function(accounts) {
  it('should deploy the token and store the address', function(done){
    LightstreamToken.deployed().then(async function(instance) {
      assert(instance.address, 'Token address couldn\'t be stored');
      done();
    });
  });

  it('should transfer the ownership to the crowdsale contract', function(done){
    LightstreamToken.deployed().then(async function(instance) {
      const data = await instance.transferOwnership(LightstreamCrowdsale.address);
      const owner = await instance.owner();
      assert.equal(LightstreamCrowdsale.address, owner);
      done();;
    });
  });
});




contract('TeamDistribution', function(accounts) {
  before(async()=> {
      LightstreamCrowdsale.deployed().then(async function(instance) {
        // finalaize the sale which will mint the tokens and delilver them to the Team Distribution Contract
      try {
        const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 3); // Travel three months into the future for testing
        const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

        const hasClosed = await instance.hasClosed.call();
        const isFinalized = await instance.isFinalized.call();
        const owner = await instance.owner.call();

        console.log('hasClosed', hasClosed);
        console.log('isFinalized', isFinalized);
        console.log('owner', owner);
        console.log('acct0', accounts[0]);

        // finalaize the sale which will mint the tokens and delilver them to the Team Distribution Contract
        const finalize = await instance.finalize({from: account[0]});
        console.log(finalize);
        const mineAgain = await mineBlock();
      } catch(error){
        console.log('finalize -- error', error);
      }
    });
  });

  it('should deploy the Team Distribution contract and store the address', function(done){
    TeamDistribution.deployed().then(async function(instance) {
      assert(instance.address, 'Token address couldn\'t be stored');
      done();
    });
  });

  it('should have 135 million Lightstream tokens in it', function(done){
    TeamDistribution.deployed().then(async function(instance) {
      done();
    });
  });

});


contract('LightstreamCrowdsale', function(accounts) {
  it('should deploy the Lightstream Crowdsale contract and store the address', function(done){
    LightstreamCrowdsale.deployed().then(async function(instance) {
      assert(instance.address, 'Token address couldn\'t be stored');
      done();
    });
  });

  it('The owner should be able to add an address to the whitelist', function(done){
    LightstreamCrowdsale.deployed().then(async function(instance) {
      const transaction = await instance.addAddressToWhitelist(accounts[1], {from: accounts[0]});
      const whitelisted = await instance.whitelist(accounts[1]);
      console.log('whitelisted', whitelisted);
      assert(whitelisted);
      done();
    });
  });

  it('A whitelisted address should be able to purchase tokens', function(done){
    LightstreamCrowdsale.deployed().then(async function(instance) {
      const etherInWei = web3._extend.utils.toWei(1, 'ether');
      const weiBigNumber = web3._extend.utils.toBigNumber(etherInWei);

      try {
        const timeTravelPromise = await timeTravel(36 * 60 * 60);
        const mineBlockPromise = await mineBlock();
        const now = await instance.returnNow.call();
        const startTime = await instance.openingTime.call();

        console.log('sta', startTime);
        console.log('now', now);
        const transaction = await instance.buyTokens(accounts[1], { from: accounts[1], value: weiBigNumber });

      } catch(error){
        console.log('timeTravelPromise', error);
      }

      done();
    });
  });

});