# SDD Selector — common tasks
# Usage: make           # list targets
#        make <target>

NODE  ?= node
NPM   ?= npm
PACK  ?= packs/finance-tech.json
PACK2 ?= packs/general-engineering.json
PAGE  ?= index.html
PACK2_OUT ?= /tmp/general-engineering.html

UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
  OPEN ?= open
else
  OPEN ?= xdg-open
endif

.DEFAULT_GOAL := help

.PHONY: help
help: ## List common targets
	@printf "SDD Selector — make <target>\n\n"
	@awk 'BEGIN {FS = ":.*##"; pad = 18} \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-*s\033[0m %s\n", pad, $$1, $$2 }' $(MAKEFILE_LIST)
	@printf "\nOverrides: PACK=$(PACK)  PAGE=$(PAGE)  NODE=$(NODE)\n"

##@ Run

.PHONY: open
open: ## Open the shipped page in a browser
	$(OPEN) "$(PAGE)"

.PHONY: run
run: open ## Alias for open

.PHONY: selftest-browser
selftest-browser: ## Open the page with ?selftest
	$(OPEN) "$(PAGE)?selftest"

.PHONY: selftest
selftest: ## Headless in-page fixture suite
	$(NODE) tools/selftest-page.mjs $(PAGE)

##@ Author / build

.PHONY: build
build: ## Inline pack + expr into index.html
	$(NPM) run build

.PHONY: build-release
build-release: ## Same as build, but strip fixtures
	$(NPM) run build:release

.PHONY: validate
validate: ## Schema + referential checks (finance-tech)
	$(NPM) run validate

.PHONY: validate-all
validate-all: ## Validate both packs
	$(NPM) run validate:all

.PHONY: report
report: ## Validate with coverage report (PACK=…)
	$(NODE) tools/validate.mjs --report $(PACK)

##@ Test

.PHONY: test
test: ## Full regression (parity, lint, second pack, QC offline)
	$(NPM) test

.PHONY: test-fast
test-fast: ## Daily loop: validate, build, unit, lint, selftest, quick parity
	$(NPM) run validate:all
	$(NPM) run build
	$(NODE) --test tests/*.test.mjs
	$(NPM) run lint:structure
	$(NODE) tools/selftest-page.mjs
	$(NODE) tools/parity.mjs --self --quick

.PHONY: unit
unit: ## Node unit / harness tests
	$(NODE) --test tests/*.test.mjs

.PHONY: lint
lint: ## Structural lint (hard-coded ids)
	$(NPM) run lint:structure

.PHONY: parity
parity: ## Full G-PARITY sweep vs frozen golden
	$(NPM) run parity

.PHONY: parity-quick
parity-quick: ## Smaller random parity corpus
	$(NODE) tools/parity.mjs --quick

.PHONY: parity-self
parity-self: ## Golden-vs-golden harness smoke
	$(NODE) tools/parity.mjs --self

.PHONY: fixtures
fixtures: ## Regenerate Markdown export goldens
	$(NPM) run fixtures:markdown

.PHONY: pack2
pack2: ## Build + selftest general-engineering (throwaway HTML)
	$(NODE) tools/build.mjs --pack $(PACK2) --out $(PACK2_OUT)
	$(NODE) tools/selftest-page.mjs $(PACK2_OUT)

.PHONY: check-build
check-build: build ## Fail if index.html is out of date with the pack
	git diff --exit-code -- index.html

.PHONY: ci
ci: ## Mirror CI: validate, build freshness, full suite
	$(NPM) run validate:all
	$(NPM) run build
	git diff --exit-code -- index.html
	$(NPM) test

##@ QC experiment

.PHONY: qc-sensitivity
qc-sensitivity: ## Part A — offline question discrimination
	$(NPM) run qc:sensitivity

.PHONY: qc-generate
qc-generate: ## Part B1+B2 — vignettes + respondent fills (LLM or mock)
	$(NPM) run qc:generate

.PHONY: qc-judge
qc-judge: ## Part B3 — blind judge panel (LLM or mock)
	$(NPM) run qc:judge

.PHONY: qc-analyze
qc-analyze: ## Parts B4/C/D — metrics from committed QC JSON (no tokens)
	$(NPM) run qc:analyze

.PHONY: qc
qc: qc-sensitivity qc-analyze ## Offline QC re-score (sensitivity + analyze)

.PHONY: qc-pipeline
qc-pipeline: qc-generate qc-judge qc-analyze ## Full QC pipeline (spends tokens if API keys set)
