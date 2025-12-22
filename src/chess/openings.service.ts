import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

interface OpeningsBook {
    [fen: string]: string; // FEN -> Opening name
}

@Injectable()
export class OpeningsService implements OnModuleInit {
    private openingsBook: OpeningsBook = {};

    onModuleInit() {
        this.loadOpeningsBook();
    }

    /**
     * Load the openings book from JSON file
     */
    private loadOpeningsBook(): void {
        try {
            const openingsPath = join(__dirname, '..', 'resources', 'openings.json');
            const fileContent = readFileSync(openingsPath, 'utf-8');
            this.openingsBook = JSON.parse(fileContent);
            console.log(`✅ Loaded ${Object.keys(this.openingsBook).length} opening positions`);
        } catch (error) {
            console.error('❌ Failed to load openings book:', error.message);
            this.openingsBook = {};
        }
    }

    /**
     * Check if a position (FEN) is a known opening position
     * @param fen The FEN string of the position
     * @returns The opening name if found, or null
     */
    isOpeningPosition(fen: string): string | null {
        // Extract position part of FEN (without move counters)
        const fenPosition = this.normalizeFen(fen);
        return this.openingsBook[fenPosition] || null;
    }

    /**
     * Normalize FEN to match the openings book format
     * The openings book uses FEN without the halfmove/fullmove counters
     */
    private normalizeFen(fen: string): string {
        // Split FEN into parts and take position, side to move, castling, en passant
        const parts = fen.split(' ');
        // Some opening books use only the position part
        // Try different formats
        const positionOnly = parts[0];

        // First try exact match
        if (this.openingsBook[fen]) {
            return fen;
        }

        // Try position + side to move + castling + en passant
        if (parts.length >= 4) {
            const partialFen = parts.slice(0, 4).join(' ');
            if (this.openingsBook[partialFen]) {
                return partialFen;
            }
        }

        // Try just position
        if (this.openingsBook[positionOnly]) {
            return positionOnly;
        }

        return positionOnly;
    }

    /**
     * Get the opening name for a position
     */
    getOpeningName(fen: string): string | null {
        return this.isOpeningPosition(fen);
    }

    /**
     * Check if we're still in the opening phase (first N moves)
     */
    isOpeningPhase(moveNumber: number): boolean {
        // Consider first 15 moves as opening phase
        return moveNumber <= 15;
    }
}
