export {};
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const param_file_path = network === 'kovan' ? '../utils/kovan_params' : '../utils/main_params'

const { POOLS } = require(param_file_path);

let pools: String[] = [];
let tokens: String[] = [];


async function main() {

  console.log('Deploying a new Paladin Controller ...')

  const deployer = (await hre.ethers.getSigners())[0];

  for(let p in POOLS){
    pools.push(POOLS[p].POOL)
    tokens.push(POOLS[p].TOKEN)
  }

  const Controller = await ethers.getContractFactory("PaladinController");

  const controller = await Controller.deploy();
  await controller.deployed();

  await controller.setInitialPools(tokens, pools);

  console.log('New Paladin Controller : ')
  console.log(controller.address)
  console.log('(controller address needs to be updated for PalPools & for PalLoanToken)')

  await controller.deployTransaction.wait(5);

  await hre.run("verify:verify", {
    address: controller.address,
    constructorArguments: [],
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