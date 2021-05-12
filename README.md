# Paladin


Paladin smart contracts


Lending protocol for governance power (inspired by Compound lending system). Instead of sending the tokens to the borrower, the tokens are moved to a smart contract that will delegate its governance power to the borrower


## `palToken`

A palToken Pools hold the governance token, allows user to deposit or withdraw them, and to create Borrows.

A Borrow represent a loan. Loans are not collateralized, but the borrower needs to pay fees when starting the loan, instead of paying interests when reimbursing the loan. A certain amount of fees represents the duration of the loan (in blocks), depending on the Borrow Rate.



### `deposit(uint amount)`
Send the underlying token to the Pool, and gets a palToken in returned, representing the amount deposited + all accrued interests


### `withdraw(uint amount)`
Send an amount of palToken to the Pool to retrieve a corresponding amount of underlying token


### `borrow(uint amount, uint feesAmount)`
Creates a new Borrow, and deploy a new Loan Pool contract to hold the loan.

amount parameter is the amount of underlying token to borrow

feesAmount parameter is the amount of fees paid for the loan.


### `expandBorrow(addres loanPool, uint feesAmount)`
Reserved for the Loan owner.

Allow to pay an extra amount of fees to expand the Loan duration


### `closeBorrow(address loanPool)`
Reserved for the Loan owner.

Allow to close a Borrow, and retrieve all unused fees from the Loan.


### `killBorrow(address loanPool)`
Forbidden to Loan owner.

Allow to kill a Loan that used all of its fees (= loan duration is over).

Killer (caller of this function) gets a reward for killing the Loan.





Other functions coming soon.





## `palLoan`

A smart contract deployed by a palToken Pool to bear the Loan, and delegate the governance power to the borrower.

Also holds the fees paid by the borrower.






## `PaladinController`


Controller contract, that list all palToken Pools, and 







## `InterestModule`


Smart contract to calculate Utilization Rate, Borrow Rate and Supply Rate of a palToken Pool. Based on a JumpRate Interest Model







## Kovan addresses 


Controller : 0xB49691E739C395a7abaecD95073784202C112542


Interest Module : 0xBc2269b1F0bF5FC7fd110Cb245b815C5Bdc647e3


Basic Delegator : 0xA66141f1538D1B3259A42524518d4081822D6Fef


AAVE Delegator : 0x1094F287e125681746C9A78a503106C4763d31a2


palAAVE Token : 0x39294e759f88250456d2Bb53567682951b362Da0  
palAAVE Pool : 0xE41D688C3E8ed77B15C60a2EEB1D1437C3e54519

palCOMP Token : 0x3ec20DD2dD5de4e29C1BF83B24F5C2255DA39d27  
palCOMP Pool : 0xF64eE92a6791f28C30Da25b965CEB52874F4441B

palUNI Token : 0x799a0381Fa6b2858e166FbAD6145EbC6bAB279cc  
palUNI Pool : 0x72e93508cd17583e9177a6afED3008B640c5C884

palStkAAVE Token : 0x9602dbE4135E02726EC3FDc107aB9a838D872587  
palStkAAVE Pool : 0xcB56D61C00e6c72427498f5A993611b4a80108ac
