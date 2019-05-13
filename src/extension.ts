import * as vscode from 'vscode';
import * as path from "path";
import * as unzipper from 'unzipper';
import * as request from 'request-promise';

const API_URL = "https://start.vertx.io";
const LANGUAGES = [{ label: "Java", value: "java", }, { label: "Kotlin", value: "kotlin" }];
const BUILD_TOOLS = [{ label: "Maven", value: "maven", }, { label: "Gradle", value: "gradle" }];
const JDK_VERSIONS = [{ label: "JDK 1.8", value: "1.8", }, { label: "JDK 11", value: "11" }];

export interface Version {
	number: string;
	exclusions: string[];
}

export interface VertxDependency {
	name: string;
	artifactId: string;
	description?: string;
}
export interface StackItem {
	category: string;
	description?: string;
	items: VertxDependency[];
}
export interface Metdata {
	defaults: any;
	stack: StackItem[];
	versions: Version[];
	languages: string[];
	jdkVersions: string[];
	buildTools: string[];
	vertxVersions: string[];
}

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("vertxStarter.createVertxProject", () => {
		createVertxProject();
	});
	context.subscriptions.push(disposable);
}

async function createVertxProject() {
	const metadata = await getMetadata();
	const dependencies: { label: string; value: string; }[] = [];
	metadata.stack.forEach((item) => {
		item.items.forEach((dependency) => {
			dependencies.push({ label: dependency.name, value: dependency.artifactId });
		});
	});

	const vertxVersion = await vscode.window.showQuickPick(
		metadata.vertxVersions,
		{ ignoreFocusOut: true, placeHolder: "Choose a Vert.x version" }
	);

	const language = await vscode.window.showQuickPick(
		LANGUAGES,
		{ ignoreFocusOut: true, placeHolder: "Choose a language" }
	).then((it) => {
		if (it) {
			return it.value;
		}
	});


	const buildTool = await vscode.window.showQuickPick(
		BUILD_TOOLS,
		{ ignoreFocusOut: true, placeHolder: "Project a build tool" }
	).then((it) => {
		if (it) {
			return it.value;
		}
	});

	const groupId = await vscode.window.showInputBox(
		{ ignoreFocusOut: true, placeHolder: "Project GroupId" }
	);
	if (!groupId) {
		vscode.window.showErrorMessage("Impossible to Create Vert.x Project: No groupId provided.");
		return;
	}

	const artifactId = await vscode.window.showInputBox(
		{ ignoreFocusOut: true, placeHolder: "Project ArtifactId" }
	);
	if (!artifactId) {
		vscode.window.showErrorMessage("Impossible to Create Vert.x Project: No artifactId provided.");
		return;
	}

	const vertxDependencies = await vscode.window.showQuickPick(
		dependencies,
		{ canPickMany: true, ignoreFocusOut: true, matchOnDetail: true, matchOnDescription: true, placeHolder: "Package Name" }
	).then((picks) => {
		if (picks && picks.push.length > 0) {
			return picks.map((it) => it.value);
		}
		return [];
	});

	let packageName = "";

	let hasCustomPackageName = await vscode.window.showQuickPick(
		['No', 'Yes'],
		{ ignoreFocusOut: true, placeHolder: "Define a custom package Name?" }
	);
	if (hasCustomPackageName && hasCustomPackageName === 'Yes') {
		let customPackageName = await vscode.window.showInputBox(
			{ ignoreFocusOut: true, placeHolder: "Package Name" }
		);
		if (customPackageName) {
			packageName = customPackageName;
		}
	}

	const jdkVersion = await vscode.window.showQuickPick(
		JDK_VERSIONS,
		{ ignoreFocusOut: true, placeHolder: "Choose a JDK version" }
	).then((it) => {
		if (it) {
			return it.value;
		}
	});

	const targetDir = await vscode.window.showOpenDialog(
		{ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }
	);
	if (!(targetDir && targetDir[0])) {
		vscode.window.showErrorMessage("Impossible to Create Vert.x Project: No directory provided.");
		return;
	}

	const projectDir = vscode.Uri.file(path.join(targetDir[0].fsPath, artifactId));

	var projectUrl = `${API_URL}/starter.zip?` +
		`groupId=${groupId}&` +
		`artifactId=${artifactId}&` +
		`buildTool=${buildTool}&` +
		`language=${language}&` +
		`vertxVersion=${vertxVersion}&` +
		`vertxDependencies=${vertxDependencies.join(',')}&` +
		`packageName=${packageName}&` +
		`jdkVersion=${jdkVersion}`;

	await downloadProject(projectUrl, projectDir);

	let success = await vscode.commands.executeCommand('vscode.openFolder', projectDir, true);
}

async function getMetadata() {
	return await request.get(`${API_URL}/metadata`)
		.then((body) => {
			const metadata: Metdata = JSON.parse(body);
			return metadata;
		});
}

async function downloadProject(url: string, targetDir: vscode.Uri) {
	return request.get(url, { headers: { 'User-Agent': 'vscode-vertx-starter' } }).pipe(unzipper.Extract({ path: targetDir.fsPath })).promise();
}

export function deactivate() { }