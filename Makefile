BONFYRE_BIN ?= $(HOME)/.local/bin
.PHONY: setup build clean check
setup:
	git config core.hooksPath .githooks
	@for b in $(BONFYRE_BIN)/bonfyre-*; do echo "  ✓ $$(basename $$b)"; done
build:
	.githooks/post-commit
clean:
	rm -rf artifacts/*.json artifacts/*.md site/*.html
check:
	@missing=0; for b in bonfyre-emit bonfyre-transcribe bonfyre-brief bonfyre-tag; do \
	  command -v $$b >/dev/null 2>&1 || { echo "  ✗ $$b missing"; missing=1; }; done; \
	[ $$missing -eq 0 ] && echo "All required binaries found."
