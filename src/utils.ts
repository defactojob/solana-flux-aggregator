import { Connection, BpfLoader, PublicKey } from "@solana/web3.js"

import { AggregatorLayout, SubmissionLayout, OracleLayout } from "./FluxAggregator"

import { solana, Wallet, NetworkName } from "solray"

export async function calculatePayfees(dataLength: number, conn: Connection): Promise<number> {
  
  let fees = 0
  const { feeCalculator } = await conn.getRecentBlockhash()

  const NUM_RETRIES = 500
  fees +=
    feeCalculator.lamportsPerSignature *
      (BpfLoader.getMinNumSignatures(dataLength) + NUM_RETRIES) +
    (await conn.getMinimumBalanceForRentExemption(dataLength))

  // Calculate the cost of sending the transactions
  fees += feeCalculator.lamportsPerSignature * 100

  return fees
}

export function getSubmissionValue(submissions: []): number {
  const values = submissions
    .filter((s: any) => s.value != 0)
    .map((s: any) => s.value)
    .sort((a, b) => a - b)

  let len = values.length
  if (len == 0) {
    return 0
  } else if (len == 1) {
    return values[0]
  } else {
    let i = len / 2
    return len % 2 == 0 ? (values[i] + values[i-1])/2 : values[i]
  }

}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

export function decodeAggregatorInfo(accountInfo) {

  const data = Buffer.from(accountInfo.data)
  const aggregator = AggregatorLayout.decode(data)

  const minSubmissionValue = aggregator.minSubmissionValue.readBigUInt64LE().toString()
  const maxSubmissionValue = aggregator.maxSubmissionValue.readBigUInt64LE().toString()
  const submitInterval = aggregator.submitInterval.readInt32LE()
  const description = aggregator.description.toString()
  
  // decode oracles
  let submissions: [] = []
  let oracles: [] = []
  let submissionSpace = SubmissionLayout.span
  let updateTime = '0'

  for (let i = 0; i < aggregator.submissions.length / submissionSpace; i++) {
    let submission = SubmissionLayout.decode(
      aggregator.submissions.slice(i*submissionSpace, (i+1)*submissionSpace)
    )
    submission.oracle = new PublicKey(submission.oracle)
  
    submission.time = submission.time.readBigInt64LE().toString()
    submission.value = submission.value.readBigInt64LE().toString()*1
    if (!submission.oracle.equals(new PublicKey(0))) {
      submissions.push(submission as never)
      oracles.push(submission.oracle.toBase58() as never)
      
    }
    if (submission.time > updateTime) {
      updateTime = submission.time
    }
  }

  return {
    minSubmissionValue: minSubmissionValue,
    maxSubmissionValue: maxSubmissionValue,
    submissionValue: getSubmissionValue(submissions),
    submitInterval,
    description,
    oracles,
    updateTime,
  }
}

export function decodeOracleInfo(accountInfo) {
  const data = Buffer.from(accountInfo.data)
 
  const oracle = OracleLayout.decode(data)

  oracle.submission = oracle.submission.readBigUInt64LE().toString()
  oracle.nextSubmitTime = oracle.nextSubmitTime.readBigUInt64LE().toString()
  oracle.description = oracle.description.toString()
  oracle.isInitialized = oracle.isInitialized != 0
  oracle.withdrawable = oracle.withdrawable.readBigUInt64LE().toString()
  oracle.aggregator = new PublicKey(oracle.aggregator).toBase58()
  oracle.owner = new PublicKey(oracle.owner).toBase58()

  return oracle
}

export async function connectTo(network: NetworkName): Promise<Connection> {
  const conn = solana.connect(network as NetworkName)
  return conn
}

export async function newWallet(): Promise<any> {
  const mnemonic = Wallet.generateMnemonic()

  const wallet = await Wallet.fromMnemonic(mnemonic, null as any)

  return {
    mnemonic,
    account: wallet.account
  }
}
