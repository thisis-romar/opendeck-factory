/**
 * Shared GraphQL + gh CLI utilities for all gh-*.mjs scripts.
 *
 * Exports:
 *   gql(query, ...extra)         — single GraphQL call, throws on error
 *   gqlAll(makeQuery, getPage)   — paginated query, returns all items
 *   gh(...args)                  — run any gh CLI command, throws on non-zero
 */

import { spawnSync } from 'node:child_process';

/**
 * Run one GraphQL query via `gh api graphql`.
 * @param {string} query       - GraphQL query/mutation string
 * @param {...string} extra    - additional `-f key=value` args passed to gh
 * @returns {object}           - full parsed response (includes `.data`)
 * @throws on network error, non-zero exit, or GraphQL errors array
 */
export function gql(query, ...extra) {
  const r = spawnSync('gh', ['api', 'graphql', '-f', `query=${query}`, ...extra], { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`gh api graphql failed: ${r.stderr?.trim()}`);
  const d = JSON.parse(r.stdout);
  if (d.errors) throw new Error(`GraphQL errors: ${JSON.stringify(d.errors)}`);
  return d;
}

/**
 * Paginate a GraphQL query that uses cursor-based pagination.
 *
 * @param {(afterClause: string) => string} makeQuery
 *   Called each iteration. `afterClause` is either '' (first page)
 *   or `, after: "cursor"` (subsequent pages). Embed it directly
 *   inside your `items(first: 100<afterClause>)` call.
 *
 * @param {(data: object) => { nodes: any[], pageInfo: { hasNextPage: boolean, endCursor: string } }} getPage
 *   Extracts the page object from the raw `result.data`.
 *
 * @returns {any[]} All nodes across all pages.
 *
 * @example
 *   const items = gqlAll(
 *     after => `{ user(login:"thisis-romar") { projectV2(number:4) {
 *       items(first:100${after}) {
 *         nodes { id ... }
 *         pageInfo { hasNextPage endCursor }
 *       } } } }`,
 *     data => data.user.projectV2.items
 *   );
 */
export function gqlAll(makeQuery, getPage) {
  const items = [];
  let cursor = null;
  let hasNext = true;
  while (hasNext) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const result = gql(makeQuery(afterClause));
    const page = getPage(result.data);
    items.push(...(page.nodes ?? []));
    hasNext = page.pageInfo?.hasNextPage ?? false;
    cursor = page.pageInfo?.endCursor ?? null;
  }
  return items;
}

/**
 * Run any `gh` CLI subcommand.
 * @param {...string} args
 * @returns {{ stdout: string, stderr: string, status: number }}
 * @throws on spawn error or non-zero exit
 */
export function gh(...args) {
  const r = spawnSync('gh', args, { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`gh ${args.join(' ')} failed: ${r.stderr?.trim()}`);
  return { stdout: r.stdout.trim(), stderr: r.stderr.trim(), status: r.status };
}
