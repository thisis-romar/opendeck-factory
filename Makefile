.PHONY: install-hooks

install-hooks:
	git config core.hooksPath .githooks
	chmod +x .githooks/pre-commit .githooks/prepare-commit-msg .githooks/pre-push .githooks/commit-msg .githooks/stop-git-check.sh
	@echo "Git hooks installed from .githooks/"
