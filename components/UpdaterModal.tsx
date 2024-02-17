/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorCard } from "@components/ErrorCard";
import { Link } from "@components/Link";
import { Margins } from "@utils/margins";
import { ModalContent, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { useAwaiter } from "@utils/react";
import { Button, Card, Forms, useState } from "@webpack/common";

import { Native } from "..";
import type { Commit } from "../native";
import { GitError, GitResult } from "../types";

let updateError: GitError | null = null;

async function Unwrap<T>(p: () => Promise<GitResult>) {
    const res = await p();

    if (res.ok) return res.value as T;

    updateError = res;
    return;
}


function HashLink({ repo, hash, disabled = false }: { repo: string, hash: string, disabled?: boolean; }) {
    return <Link href={`${repo}/commit/${hash}`} disabled={disabled}>
        {hash}
    </Link>;
}

export function UpdaterModal({ modalProps }: { modalProps: ModalProps; }) {
    const [x, setX] = useState(0);
    const [repo, _, repoPending] = useAwaiter(() => Unwrap<string>(Native.getRepo));
    const [updates] = useAwaiter(() => Unwrap<Commit[]>(Native.getNewCommits), { fallbackValue: [], deps: [x] });

    const isOutdated = (updates?.length ?? 0) > 0;
    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalContent>
                {updates == null && updateError ? (
                    <>
                        <Forms.FormText>Failed to check updates. Check the console for more info</Forms.FormText>
                        <ErrorCard style={{ padding: "1em" }}>
                            <p>{updateError.error.stderr || updateError.error.stdout || "An unknown error occurred"}</p>
                        </ErrorCard>
                    </>
                ) : (
                    <Forms.FormText className={Margins.bottom8}>
                        {isOutdated ? (updates!.length === 1 ? "There is 1 Update" : `There are ${updates!.length} Updates`) : "Up to Date!"}
                    </Forms.FormText>
                )}


                {isOutdated && (
                    <Card style={{ padding: "0 0.5em" }}>
                        {updates!.map(({ hash, longHash, author, message }) => (
                            <div style={{
                                marginTop: "0.5em",
                                marginBottom: "0.5em"
                            }}>
                                <code><HashLink repo={repo!} hash={longHash} disabled={repoPending} /></code>
                                <span style={{
                                    marginLeft: "0.5em",
                                    color: "var(--text-normal)"
                                }}>{message} - {author}</span>
                            </div>
                        ))
                        }
                    </Card>
                )}

                {isOutdated && <Button onClick={() => Unwrap(Native.update)}>Update</Button>}
                <Button onClick={() => setX(x => x + 1)}>Check for updates</Button>
            </ModalContent>
        </ModalRoot>
    );
}


export const openUpdaterModal = () => !IS_WEB && openModal(modalProps => <UpdaterModal modalProps={modalProps} />);
