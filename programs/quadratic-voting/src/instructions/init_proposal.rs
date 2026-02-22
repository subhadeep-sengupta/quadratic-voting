use anchor_lang::prelude::*;

use crate::state::{Dao, Proposal};

#[derive(Accounts)]
pub struct InitProposal<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub dao_account: Account<'info, Dao>,

    #[account(
        init,
        payer = creator,
        space = Proposal::DISCRIMINATOR.len() + Proposal::INIT_SPACE,
        seeds = [b"proposal", dao_account.key().as_ref(), dao_account.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitProposal<'info> {
    pub fn init_proposal(&mut self, metadata: String) -> Result<()> {
        self.proposal.set_inner(Proposal {
            metadata,
            authority: self.creator.key(),
            yes_vote_count: 0,
            no_vote_count: 0,
            bump: self.proposal.bump,
        });

        Ok(())
    }
}
