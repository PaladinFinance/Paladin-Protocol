export {};
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const param_file_path = network === 'kovan' ? '../utils/kovan_params' : '../utils/main_params'

const { PAL_LOAN_TOKEN, ADDRESS_REGISTRY } = require(param_file_path);

const old_controller = ''
const new_controller = ''


async function main() {

    console.log('Update Paladin Controller ...')
  
    const admin = (await hre.ethers.getSigners())[0];
  
    const Controller = await ethers.getContractFactory("PaladinController");
    const Registry = await ethers.getContractFactory("AddressRegistry");
    const PalLoanToken = await ethers.getContractFactory("PalLoanToken");
  
    const controller = Controller.attach(old_controller);
    const registry = Registry.attach(ADDRESS_REGISTRY);
    const loanToken = PalLoanToken.attach(PAL_LOAN_TOKEN);
  
    await controller.setPoolsNewController(new_controller);

    await loanToken.setNewController(new_controller);

    await registry._setController(new_controller);
    
}
  
  
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });