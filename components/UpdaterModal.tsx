/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { ErrorCard } from "@components/ErrorCard";
import { Link } from "@components/Link";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import { useAwaiter } from "@utils/react";
import { Alerts, Button, Flex, Forms, Parser, React, Toasts } from "@webpack/common";

import { Flogger } from "..";
import { changes, checkForUpdatesReal, getHash, getRepo, updateError } from "../utils/updater";

interface CommonProps {
    repo: string;
    repoPending: boolean;
}

export const cl = classNameFactory("updater-modal-");


function withDispatcher(dispatcher: React.Dispatch<React.SetStateAction<boolean>>, action: () => any) {
    return async () => {
        dispatcher(true);
        try {
            await action();
        } catch (e: any) {
            Flogger.error("Failed to update", e);
            if (!e) {
                var err = "An unknown error occurred (error is undefined).\nPlease try again.";
            } else if (e.code && e.cmd) {
                const { code, path, cmd, stderr } = e;

                if (code === "ENOENT")
                    var err = `Command \`${path}\` not found.\nPlease install it and try again`;
                else {
                    var err = `An error occurred while running \`${cmd}\`:\n`;
                    err += stderr || `Code \`${code}\`. See the console for more info`;
                }

            } else {
                var err = "An unknown error occurred. See the console for more info.";
            }
            Alerts.show({
                title: "Oops!",
                body: (
                    <ErrorCard>
                        {err.split("\n").map(line => <div>{Parser.parse(line)}</div>)}
                    </ErrorCard>
                )
            });
        }
        finally {
            dispatcher(false);
        }
    };
}



function HashLink({ repo, hash, disabled = false }: { repo: string, hash: string, disabled?: boolean; }) {
    return <Link href={`${repo}/commit/${hash}`} disabled={disabled}>
        {hash}
    </Link>;
}

function Updatable(props: CommonProps) {
    const [updates, setUpdates] = React.useState(changes);
    const [isChecking, setIsChecking] = React.useState(false);
    const [isUpdating, setIsUpdating] = React.useState(false);

    const isOutdated = (updates?.length ?? 0) > 0;

    return (
        <>
            {!updates && updateError ? (
                <>
                    <Forms.FormText>Failed to check updates. Check the console for more info</Forms.FormText>
                    <ErrorCard style={{ padding: "1em" }}>
                        <p>{updateError.stderr || updateError.stdout || "An unknown error occurred"}</p>
                    </ErrorCard>
                </>
            ) : (
                <Forms.FormText className={Margins.bottom8}>
                    {isOutdated ? `There are ${updates.length} Updates` : "Up to Date!"}
                </Forms.FormText>
            )}

            {isOutdated && <Changes updates={updates} {...props} />}

            <Flex className={classes(Margins.bottom8, Margins.top8)}>
                {isOutdated && <Button
                    size={Button.Sizes.SMALL}
                    disabled={isUpdating || isChecking}
                    onClick={withDispatcher(setIsUpdating, async () => {
                        if (await update()) {
                            setUpdates([]);
                            await new Promise<void>(r => {
                                Alerts.show({
                                    title: "Update Success!",
                                    body: "Successfully updated. Restart now to apply the changes?",
                                    confirmText: "Restart",
                                    cancelText: "Not now!",
                                    onConfirm() {
                                        relaunch();
                                        r();
                                    },
                                    onCancel: r
                                });
                            });
                        }
                    })}
                >
                    Update Now
                </Button>}
                <Button
                    size={Button.Sizes.SMALL}
                    disabled={isUpdating || isChecking}
                    onClick={withDispatcher(setIsChecking, async () => {
                        const outdated = await checkForUpdatesReal();
                        if (outdated) {
                            setUpdates(changes);
                        } else {
                            setUpdates([]);
                            Toasts.show({
                                message: "No updates found!",
                                id: Toasts.genId(),
                                type: Toasts.Type.MESSAGE,
                                options: {
                                    position: Toasts.Position.BOTTOM
                                }
                            });
                        }
                    })}
                >
                    Check for Updates
                </Button>
            </Flex>
        </>
    );
}



export function UpdaterModal({ modalProps }: { modalProps: ModalProps; }) {

    const [repo, repoErr, repoPending] = useAwaiter(getRepo, { fallbackValue: "Loading..." });
    const [gitHash, hashErr, gitHashPending] = useAwaiter(getHash, { fallbackValue: "Loading..." });

    return (
        <ModalRoot size={ModalSize.LARGE} {...modalProps} className={cl("root")}>
            <ModalHeader className={cl("header")}>
                <Forms.FormTitle tag="h4">Message Logger Updater</Forms.FormTitle>
            </ModalHeader>
            <ModalContent className={cl("content")}>

                <Forms.FormTitle tag="h5">Repo</Forms.FormTitle>

                <Forms.FormText className="vc-text-selectable">
                    {repoPending
                        ? repo
                        : repoErr || !repo
                            ? "Failed to retrieve - check console"
                            : (
                                <Link href={repo}>
                                    {repo.split("/").slice(-2).join("/")}
                                </Link>
                            )
                    }
                    {" "}
                    {/* uuh */}
                    {"("}{gitHashPending
                        ? gitHash
                        : hashErr || !gitHash || !repo
                            ? "Failed to retrieve - check console"
                            : (<HashLink hash={gitHash} repo={repo} disabled={repoPending} />)
                    }{")"}
                </Forms.FormText>

                <Forms.FormDivider className={Margins.top8 + " " + Margins.bottom8} />

                <Forms.FormTitle tag="h5">Updates</Forms.FormTitle>

            </ModalContent>
        </ModalRoot>
    );
}


export const openUpdaterModal = () => openModal(modalProps => <UpdaterModal modalProps={modalProps} />);
