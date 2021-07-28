import { ethers} from "hardhat";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { provider } = ethers;

export async function getAAVE(
    admin: SignerWithAddress,
    aave_contract: Contract,
    recipient: string,
    amount: BigNumber
) {
    const AAVE_holder = "0xF977814e90dA44bFA03b6295A0616a897441aceC" //address having enough AAVE tokens

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [AAVE_holder],
    });

    await admin.sendTransaction({
        to: AAVE_holder,
        value: ethers.utils.parseEther("10"),
      });

    const signer = await ethers.getSigner(AAVE_holder)

    await aave_contract.connect(signer).transfer(recipient, amount);

    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [AAVE_holder],
    });
}