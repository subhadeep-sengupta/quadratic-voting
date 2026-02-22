import * as anchor from '@coral-xyz/anchor';
import { Program, web3, BN } from '@coral-xyz/anchor';
import { QuadraticVoting } from '../target/types/quadratic_voting';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  mintTo,
  createAccount,
  getAccount,
} from '@solana/spl-token';

describe('quadratic-voting', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.QuadraticVoting as Program<QuadraticVoting>;
  const connection = provider.connection;

  // Test accounts
  let creator: Keypair;
  let voter: Keypair;
  let mint: PublicKey;
  let creatorTokenAccount: PublicKey;
  let voterTokenAccount: PublicKey;

  // PDAs
  let daoAccount: PublicKey;
  let daoBump: number;
  let proposal: PublicKey;
  let proposalBump: number;
  let vote: PublicKey;
  let voteBump: number;

  const daoName = 'Test DAO';
  const proposalMetadata = 'Test Proposal';

  before(async () => {
    // Generate keypairs
    creator = Keypair.generate();
    voter = Keypair.generate();

    // Airdrop SOL to accounts
    const signatures = await Promise.all([
      connection.requestAirdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(voter.publicKey, 10 * LAMPORTS_PER_SOL),
    ]);

    await Promise.all(signatures.map(sig => connection.confirmTransaction(sig)));

    // Create SPL token mint
    mint = await createMint(
      connection,
      creator, // payer
      creator.publicKey, // mint authority
      null, // freeze authority (optional)
      9 // decimals
    );

    // Create token accounts
    creatorTokenAccount = await createAccount(
      connection,
      creator,
      mint,
      creator.publicKey
    );

    voterTokenAccount = await createAccount(
      connection,
      voter,
      mint,
      voter.publicKey
    );

    // Mint tokens to creator for testing quadratic voting
    await mintTo(
      connection,
      creator,
      mint,
      creatorTokenAccount,
      creator, // mint authority
      1000 * 10 ** 9 // 1000 tokens
    );

    // Mint tokens to voter
    await mintTo(
      connection,
      creator,
      mint,
      voterTokenAccount,
      creator,
      100 * 10 ** 9 // 100 tokens
    );

    console.log('Setup complete:');
    console.log('Creator:', creator.publicKey.toBase58());
    console.log('Voter:', voter.publicKey.toBase58());
    console.log('Mint:', mint.toBase58());
  });

  it('Initializes DAO', async () => {
    // Find DAO PDA
    [daoAccount, daoBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('dao'),
        creator.publicKey.toBuffer(),
        Buffer.from(daoName),
      ],
      program.programId
    );

    await program.methods
      .initDao(daoName)
      .accountsStrict({
        creator: creator.publicKey,
        daoAccount: daoAccount,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([creator])
      .rpc();


    console.log('DAO initialized:', daoAccount.toBase58());
  });

  it('Initializes Proposal', async () => {
    const daoBefore = await program.account.dao.fetch(daoAccount);
    const proposalCount = daoBefore.proposalCount;

    const proposalCountBuffer = Buffer.alloc(8);
    proposalCountBuffer.writeBigUInt64LE(BigInt(proposalCount));

    [proposal, proposalBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('proposal'),
        daoAccount.toBuffer(),
        proposalCountBuffer,
      ],
      program.programId
    );

    await program.methods
      .initProposal(proposalMetadata)
      .accountsStrict({
        creator: creator.publicKey,
        daoAccount: daoAccount,
        proposal: proposal,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([creator])
      .rpc();
    console.log('Proposal initialized:', proposal.toBase58());
  });

  it('Casts a vote with quadratic voting', async () => {
    const tokenAccountInfo = await getAccount(connection, creatorTokenAccount);
    const tokenBalance = Number(tokenAccountInfo.amount);
    const expectedVoteCredits = Math.floor(Math.sqrt(tokenBalance));

    console.log('Token balance:', tokenBalance);
    console.log('Expected vote credits (sqrt):', expectedVoteCredits);

    // Find Vote PDA
    [vote, voteBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('vote'),
        creator.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Cast vote (1 = yes, 0 = no)
    const voteType = 1; // Yes vote

    await program.methods
      .castVote(voteType)
      .accountsStrict({
        voter: creator.publicKey,
        dao: daoAccount,
        proposal: proposal,
        vote: vote,
        creatorTokenAccount: creatorTokenAccount,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([creator])
      .rpc();

    // Fetch and verify Vote account
    const voteAccount = await program.account.vote.fetch(vote);
    console.log('Vote cast:', vote.toBase58());
    console.log('Vote credits used:', voteAccount.voteCredits.toNumber());
  });

  it('Allows second voter to vote', async () => {
    // Find new Vote PDA for second voter
    const [voter2Vote, voter2Bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('vote'),
        voter.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Get voter's token balance
    const tokenAccountInfo = await getAccount(connection, voterTokenAccount);
    const tokenBalance = Number(tokenAccountInfo.amount);
    const expectedVoteCredits = Math.floor(Math.sqrt(tokenBalance));

    console.log('Voter 2 token balance:', tokenBalance);
    console.log('Expected vote credits:', expectedVoteCredits);

    // Cast vote
    await program.methods
      .castVote(0) // No vote
      .accountsStrict({
        voter: voter.publicKey,
        dao: daoAccount,
        proposal: proposal,
        vote: voter2Vote,
        creatorTokenAccount: voterTokenAccount,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([voter])
      .rpc();

    console.log('Second vote cast:', voter2Vote.toBase58());
  });
});
