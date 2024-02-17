/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { ModalContent, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import { useAwaiter } from "@utils/react";
import { Alerts, Button, Card, Forms, React, useState } from "@webpack/common";

import { Native } from "..";
import type { Commit, GitInfo } from "../native";
import { GitError, GitResult } from "../types";

let updateError: GitError | null = null;

async function Unwrap<T>(p: () => Promise<GitResult>) {
    const res = await p();

    if (res.ok) return res.value as T;

    updateError = res;
    return;
}

// half of this file is just a copy of the original updater modal
function HashLink({ repo, longHash, disabled = false }: { repo: string, longHash: string, disabled?: boolean; }) {
    return <Link href={`${repo}/commit/${longHash}`} disabled={disabled}>
        {longHash.slice(0, 7)}
    </Link>;
}

const cl = classNameFactory("vc-updater-modal-");
export function UpdaterModal({ modalProps }: { modalProps: ModalProps; }) {
    const [x, setX] = useState(0);
    const [repoInfo, err, repoPending] = useAwaiter(() => Unwrap<GitInfo>(Native.getRepoInfo));
    const [updates] = useAwaiter(() => Unwrap<Commit[]>(Native.getNewCommits), { fallbackValue: [], deps: [x] });

    const isOutdated = (updates?.length ?? 0) > 0;

    async function onUpdate() {
        const res = await Native.update();
        if (!res.ok) {
            return Alerts.show({
                title: "Welp!",
                body: "Failed to update. Check the console for more info",
            });
        }
        if (!(await VencordNative.updater.rebuild()).ok) {
            return Alerts.show({
                title: "Welp!",
                body: "The Build failed. Please try manually building the new update",
            });
        }

        Alerts.show({
            title: "Update Success!",
            body: "Successfully updated. Restart now to apply the changes?",
            confirmText: "Restart",
            cancelText: "Not now!",
            onConfirm() {
                relaunch();
            },
        });
    }
    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalContent className={cl("content")}>
                <Forms.FormTitle tag="h5">Repo</Forms.FormTitle>
                {!repoPending && repoInfo != null && err == null && (
                    <>
                        <Forms.FormText className="vc-text-selectable">
                            {repoPending
                                ? repoInfo.repo
                                : err
                                    ? "Failed to retrieve - check console"
                                    : (
                                        <Link href={repoInfo.repo}>
                                            {repoInfo.repo!.split("/").slice(-2).join("/")}
                                        </Link>
                                    )
                            }
                            {" "}(<HashLink longHash={repoInfo.gitHash} repo={repoInfo.repo} disabled={repoPending} />)
                        </Forms.FormText>
                    </>
                )}

                <Forms.FormDivider className={Margins.top8 + " " + Margins.bottom8} />
                <Forms.FormTitle tag="h5">Updates</Forms.FormTitle>

                {(updates == null || repoInfo == null) && updateError ? (
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
                                <code><HashLink repo={repoInfo?.repo!} longHash={longHash} disabled={repoPending} /></code>
                                <span style={{
                                    marginLeft: "0.5em",
                                    color: "var(--text-normal)"
                                }}>{message} - {author}</span>
                            </div>
                        ))
                        }
                    </Card>
                )}

                <Flex className={classes(Margins.bottom8, Margins.top8)}>
                    {isOutdated && <Button onClick={onUpdate}>Update</Button>}
                    <Button onClick={() => setX(x => x + 1)}>Check for updates</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}


export const openUpdaterModal = () => !IS_WEB && openModal(modalProps => <UpdaterModal modalProps={modalProps} />);
