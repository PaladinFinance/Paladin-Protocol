export { };
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const params_path = () => {
  if (network === 'kovan') {
    return '../utils/kovan_params'
  }
  else if (network === 'rinkeby') {
    return '../utils/rinkeby_params'
  }
  else {
    return '../utils/main_params'
  }
}

const param_file_path = params_path();

const { POOLS } = require(param_file_path);

let pools: String[] = [];
let tokens: String[] = [];

async function main() {

  console.log('Deploying a new Paladin Controller ...')

  const deployer = (await hre.ethers.getSigners())[0];

  for (let p in POOLS) {
    pools.push(POOLS[p].POOL)
    tokens.push(POOLS[p].TOKEN)
  }

  const Proxy = await ethers.getContractFactory("ControllerProxy");
  const Controller = await ethers.getContractFactory("PaladinController");

  const proxy = await Proxy.deploy();
  await proxy.deployed();



  await proxy.setInitialPools(tokens, pools);

  console.log('New Paladin Controller (proxy) : ')
  console.log(proxy.address)
  console.log('(need to set implementation & accept it)')
  console.log('(controller address needs to be updated for PalPools & for PalLoanToken)')

  await proxy.deployTransaction.wait(30);

  await hre.run("verify:verify", {
    address: proxy.address,
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