export {};
const hre = require("hardhat");
const ethers = hre.ethers;


const delegator_name = 'PalDelegatorClaimer'


async function main() {

  console.log('Deploying a new Delegator : ' + delegator_name + '  ...')

  const deployer = (await hre.ethers.getSigners())[0];

  const Delegator = await ethers.getContractFactory(delegator_name);

  const delegator = await Delegator.deploy();
  await delegator.deployed();

  console.log('New ' + delegator_name + ' : ')
  console.log(delegator.address)

  await delegator.deployTransaction.wait(30);

  await hre.run("verify:verify", {
    address: delegator.address,
    constructorArguments: [],
    contract: "contracts/delegators/"+delegator_name+".sol:"+delegator_name
  });
  
}


main()
.then(() => {
  process.exit(0);
})
.catch(error => {
  console.error(error);
  process.exit(1);
});