export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export function canAccessApp(input: {
  approvalStatus: ApprovalStatus;
  isCandidate: boolean;
}): 'ok' | 'pending' | 'denied' {
  if (input.approvalStatus === 'pending') return 'pending';
  if (input.approvalStatus === 'rejected' || input.isCandidate) return 'denied';
  return 'ok';
}
