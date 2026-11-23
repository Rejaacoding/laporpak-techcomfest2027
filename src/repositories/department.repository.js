import { SCORE_RULES, clamp } from "../shared/constants.js";

export async function adjustDepartmentScore(tx, departmentId, scoreDelta = 0, increments = {}) {
  const dept = await tx.department.findUniqueOrThrow({ where: { id: departmentId } });
  const nextScore = Math.round(clamp(dept.integrityScore + scoreDelta, SCORE_RULES.DEPT_MIN, SCORE_RULES.DEPT_MAX) * 10) / 10;

  const data = { integrityScore: nextScore };
  for (const [field, amount] of Object.entries(increments)) {
    if (amount) {
      data[field] = { increment: amount };
    }
  }

  return tx.department.update({
    where: { id: departmentId },
    data,
  });
}
