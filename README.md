# Paladin


Paladin smart contracts


## Overview

Lending protocol for governance power. Users deposit governance tokens (`ERC20`) in a `PalPool`, and receive `PalToken` (`ERC20`) representing their part of the `PalPool`.
When borrowing, instead of sending the tokens to the borrower, the tokens are moved to a smart contract (a `PalLoan`) that will delegate its governance power to the borrower.
Each `PalLoan` is represented with an `ERC721` token (`PalLoanToken`)

View the [documentation](https://doc.paladin.vote) for a more in-depth explanation of how Paladin works.


## Dependencies & Installation


To start, make sure you have `node` & `npm` installed : 
* `node` - tested with v16.4.0
* `npm` - tested with v7.18.1

Then, clone this repo, and install the dependencies : 

```
git clone https://github.com/PaladinFinance/Paladin-Protocol.git
cd Paladin-Protocol
npm install
```

This will install `Hardhat`, `Ethers v5`, and all the hardhat plugins used in this project.


## Contracts


See the [contracts](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/contracts) directory.


## Tests


Unit tests can be found in the [test](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/test) directory.

To run all the tests : 
```
npm run test
```

To run the test on only one contract : 
```
npm run test ./test/palToken.test.ts 
npm run test ./test/palPool/*
...
```


## Deploy


Deploy to Kovan :
```
npm run build
npm run deploy_kovan
```

To deploy some contracts only, see the scripts in [scripts/deploy](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/scripts/deploy), and setting the correct parameters in [scripts/utils/kovan_params.js](https://github.com/PaladinFinance/Paladin-Protocol/tree/main/scripts/utils/kovan_params.js)


## Security & Audit


On-going


## Ressources


Website : [paladin.vote](https://.paladin.vote)

Documentation : [doc.paladin.vote](https://doc.paladin.vote)


## Community

For any question about this project, or to engage with us :

[Twitter](https://twitter.com/Paladin_vote)

[Discord](https://discord.com/invite/esZhmTbKHc)



## License


This project is licensed under the [MIT](https://github.com/PaladinFinance/Paladin-Protocol/blob/main/MIT-LICENSE.TXT) license


