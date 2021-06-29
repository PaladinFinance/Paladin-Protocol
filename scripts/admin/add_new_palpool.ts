export {};
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const param_file_path = network === 'kovan' ? '../utils/kovan_params' : '../utils/main_params'

const { CONTROLLER, ADDRESS_REGISTRY } = require(param_file_path);

const new_palpool = ''
const new_paltoken = ''
const underlying = ''


async function main() {

    console.log('Add new PalPool in Controller list')
  
    const admin = (await hre.ethers.getSigners())[0];
  
    const Controller = await ethers.getContractFactory("PaladinController");
    const Registry = await ethers.getContractFactory("AddressRegistry");
  
    const controller = Controller.attach(CONTROLLER);
    const registry = Registry.attach(ADDRESS_REGISTRY);
  
    await controller.addNewPool(new_paltoken, new_palpool);

    await registry._setPool(underlying, new_palpool, new_paltoken);
    
}
  
  
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });