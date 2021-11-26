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

  console.log('Deploy Implementation ...')
  const controller = await Controller.deploy();
  await controller.deployed();

  console.log('Deploy Proxy ...')
  const proxy = await Proxy.deploy();
  await proxy.deployed();

  await proxy.deployTransaction.wait(5);

  console.log('Setting Implementation for Proxy ...')
  console.log('Propose Implementation ...')
  let tx = await proxy.proposeImplementation(controller.address)
  await tx.wait(15);
  console.log('Accept Implementation ...')
  tx = await controller.becomeImplementation(proxy.address)
  await tx.wait(15);

  console.log('Setting up Pools ...')
  const poxy_controller_interface = Controller.attach(proxy.address);
  tx = await poxy_controller_interface.setInitialPools(tokens, pools);
  await tx.wait(15);

  console.log('New Paladin Controller Implementation : ')
  console.log(controller.address)
  console.log('New Paladin Controller (proxy) : ')
  console.log(proxy.address)

  await controller.deployTransaction.wait(30);

  await hre.run("verify:verify", {
    address: controller.address,
    constructorArguments: [],
  });
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