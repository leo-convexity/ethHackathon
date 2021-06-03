#!/bin/bash
set -e

if [[ "${1,,}" == '-y' ]]; then
	PROCEED=1
	Y=('-y')
else
	PROCEED=
	Y=()
fi

function X() {
	local P="$1"
	shift

	echo '#'
	if ((PROCEED)); then
		echo "# Running: $P $@"
		echo '#'
	else
		echo "# Press return to run: $P $@"
		echo -n '#'
		read
	fi
	echo '----------------------------------------------------------------'
	"./${P}.py" "$@"
	echo '----------------------------------------------------------------'
	echo '#'
	if ((PROCEED)); then
		echo '# Continuing'
		echo '#'
		echo
	else
		echo '# Press return to continue'
		echo '#'
		read
	fi
}

if true; then
	X dump_compound_usdc_data
	X local_account_balances
	X local_account_uniswap_transact "${Y[@]}" 1 buy 100000 USDC
	X local_account_balances
	X deploy_irs_agent "${Y[@]}"
	X local_account_balances
	X local_account_irs_agent "${Y[@]}" 1 deposit 50000 USDC
	X local_account_irs_agent 1 balance
	X dump_compound_usdc_data
	X local_account_irs_agent "${Y[@]}" 1 withdraw 50000 USDC
	X local_account_irs_agent 1 balance
	X local_account_balances
fi
