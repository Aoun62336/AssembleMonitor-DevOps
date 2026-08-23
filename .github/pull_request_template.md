## Pull Request Checklist

Before marking this PR as **Ready for Review**, verify each item:

### Code Quality
- [ ] Backend Python syntax compiles cleanly (`python -m compileall backend/app -q`)
- [ ] All pytest tests pass locally (`cd backend && python -m pytest tests/ -v`)
- [ ] Frontend builds without errors (`cd frontend && npm run build`)

### Infrastructure
- [ ] Terraform validates cleanly (`terraform -chdir=terraform validate`)
- [ ] Helm chart lints without warnings (`helm lint k8s/helm-chart -f ... -f ...`)
- [ ] No hardcoded secrets, tokens, or credentials committed

### Documentation
- [ ] `README.md` updated if feature-level changes were made
- [ ] Relevant `docs/` files updated if architecture or operations changed
- [ ] New scripts or tools documented in `docs/ops/VERIFICATION_PLAYBOOK.md`

### Testing Evidence (for significant changes)
- [ ] Screenshots added to `docs/assets/screenshots/` where applicable
- [ ] Incident postmortem added to `docs/ops/incidents/` if fault behaviour changed

---

**Related issue / ticket:** <!-- link here if applicable -->

**Summary of changes:** <!-- 2-3 sentences describing what this PR does and why -->
