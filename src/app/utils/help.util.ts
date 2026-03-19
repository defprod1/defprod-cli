import { HelpGenerator } from './help-generator';

export class HelpUtil {

    /**
     * Display help information (auto-generated from command tree)
     */
    public static showHelp(): void {

        const helpText: string = HelpGenerator.generateGeneralHelp();
        console.log(helpText);
    }

}

